# LN Quake

LN Quake is a game based on QuakeJS, a port of ioquake to JS. LN Quake adds Lightning Network into the mix, by allowing players to battle with each other to win Satoshis. 

### [Demo on YouTube, some explanation is provided in the subtitles](http://www.youtube.com/watch?v=yNmgKCNmmo8&cc_load_policy=1)

The idea of games where people can win Satoshis is not new, but what makes this project unique is the fact that none of the players have to deposit/withdraw money to/from a third party service: all the payments are made **directly** between the players, while the server sits in between to choose which payments can go through and which cannot (while also, potentially, taking a fee for this service).

The concept is very similar to a "2-of-3" escrow multisig, but since all of that happens on the Lightning Network, players can bet even very small amounts and the fact that the number of payments grows quadratically with the number of players becomes almost irrelevant (though, there could be ways to reduce the number of payments required by slightly changing the outcome, thanks to [@imaprincess](http://github.com/imaprincess) for the neat suggestions!). Moreover, players can participate with their own "normal" wallets, and there's no need to construct convuluted scripts and transactions, since Lightning handles all of that for you.

## Project Structure

To speed up the development during the hackathon, the "C" part (the original ioq3 code) has almost been left untouched: this increased the complexity of the whole project a little bit, because instead of having one nice daemon running, there are now two daemons, where one is a "wrapper" over the other, and it is responsible to start and manage it.

So, the final structure is made by:

* a `content` server, which acts as a "filesystem" for IOQ3 to download his files
* a `web` server which servers the index web page
* a `controller` made as c-lightning plugin (it is started by Lightningd)
  * the original `ioq3ded` which is started by the controller

This project is also loosely derived from [ln-auctions](https://github.com/afilini/ln-auctions), mostly for some low-level c-lightning plugin utils.

## How to run

You should follow the instructions down below for a first run/setup (to accept the EULA, etc), and then you should be able to use `lnquake/index.js` as a c-lightning plugin to start the whole system.

Don't forget the two `npm install`s, one in the root and one in `lnquake/`.

The code is setup to work on HTTPS, which means that you should replace the "official" content server with a proxy (you could setup your own or use mine at `https://quake-content.afilini.com`).

## How to build

Well, that's a very good question. The "original" QuakeJS is pretty old and refuses to build with modern versions of Emscripten. There's a fork (the one on which I based my code) which was supposed to work with modern compilers, but I dind't have any luck with it: in particular, every time I tried to rebuild the client (`ioquake3.js`) it would always crash with some GLSL exceptions, even if all the shaders were untouched! I ended up reusing the client from the GitHub repo (which also forced me to "wrap" some extra code around it, instead of just patching it).

The server (`ioq3ded.{js,wasm}`) should compile with a modern toolchain (I personally used `emcc 1.38.34`), but if you just want to play I strongly suggest to use the prebuilt files in `build/`. They should "Just Work" (TM).

-------------

# Original README, useful to get started

QuakeJS is a port of [ioquake3](http://www.ioquake3.org) to JavaScript with the help of [Emscripten](http://github.com/kripken/emscripten).

To see a live demo, check out [http://www.quakejs.com](http://www.quakejs.com).


## Building binaries

As a prerequisite, you'll need to have a working build of [Emscripten](http://github.com/kripken/emscripten), then:

```shell
cd quakejs/ioq3
make PLATFORM=js EMSCRIPTEN=<path_to_emscripten>
```

Binaries will be placed in `ioq3/build/release-js-js/`.

To note, if you're trying to run a dedicated server, the most up to date binaries are already included in the `build` directory of this repository.


## Running locally

Install the required node.js modules:

```shell
npm install
```

Set `content.quakejs.com` as the content server:

```shell
echo '{ "content": "content.quakejs.com" }' > bin/web.json
```

Run the server:

```shell
node bin/web.js --config ./web.json
```

Your server is now running on: [http://0.0.0.0:8080](http://0.0.0.0:8080)


## Running a dedicated server

If you'd like to run a dedicated server, the only snag is that unlike regular Quake 3, you'll need to double check the content server to make sure it supports the mod / maps you want your server to run (which you can deduce from the [public manifest](http://content.quakejs.com/assets/manifest.json)).

Also, networking in QuakeJS is done through WebSockets, which unfortunately means that native builds and web builds currently can't interact with eachother.

Otherwise, running a dedicated server is similar to running a dedicated native server command-line wise.

Setup a config for the mod you'd like to run, and startup the server with `+set dedicated 2`:

```shell
node build/ioq3ded.js +set fs_game <game> +set dedicated 2 +exec <server_config>
```

If you'd just like to run a dedicated server that isn't broadcast to the master server:

```shell
node build/ioq3ded.js +set fs_game <game> +set dedicated 1 +exec <server_config>
```

### baseq3 server, step-by-step

*Note: for the initial download of game files you will need a server wth around 1GB of RAM. If the server exits with the message `Killed` then you need more memory*

On your server clone this repository. `cd` into the `quakejs` clone and run the following commands:

```
git submodule update --init
npm install
node build/ioq3ded.js +set fs_game baseq3 +set dedicated 2
```

After running the last command continue pressing Enter until you have read the EULA, and then answer the `Agree? (y/n)` prompt. The base game files will download. When they have finished press Ctrl+C to quit the server.

In the newly created `base/baseq3` directory add a file called `server.cfg` with the following contents (adapted from [Quake 3 World](http://www.quake3world.com/q3guide/servers.html)):

```
seta sv_hostname "CHANGE ME"
seta sv_maxclients 12
seta g_motd "CHANGE ME"
seta g_quadfactor 3
seta g_gametype 0
seta timelimit 15
seta fraglimit 25
seta g_weaponrespawn 3
seta g_inactivity 3000
seta g_forcerespawn 0
seta rconpassword "CHANGE_ME"
set d1 "map q3dm7 ; set nextmap vstr d2"
set d2 "map q3dm17 ; set nextmap vstr d1"
vstr d1
```

replacing the `sv_hostname`, `g_motd` and `rconpassword`, and any other configuration options you desire.

You can now run the server with 

```
node build/ioq3ded.js +set fs_game baseq3 +set dedicated 2 +exec server.cfg
```

and you should be able to join at http://www.quakejs.com/play?connect%20SERVER_IP:27960, replacing `SERVER_IP` with the IP of your server.

## Running a content server

QuakeJS loads assets directly from a central content server. A public content server is available at `content.quakejs.com`, however, if you'd like you run your own (to perhaps provide new mods) you'll need to first repackage assets into the format QuakeJS expects.

### Repackaging assets

When repackaging assets, an asset graph is built from an incoming directory of pk3s, and an optimized set of map-specific pk3s is output to a destination directory.

To run this process:

```shell
node bin/repak.js --src <assets_src> --dest <assets>
```

And to launch the content server after the repackaging is complete:

```shell
node bin/content.js
```

Note: `./assets` is assumed to be the default asset directory. If you'd like to change that, you'll need to modify the JSON configuration used by the content server.

Once the content server is available, you can use it by launching your local or dedicated server with `+set fs_cdn <server_address>`.

## License

MIT
