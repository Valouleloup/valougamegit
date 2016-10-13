var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    ent = require('ent'),
    fs = require('fs');

// Dossier root fichiers
app.use(express.static(__dirname + '/'));

// Init variables
var players = [];
var currentId = 0;
var color = [0xF5C15F, 0x4CCE73, 0x87A9F2, 0xE66D5F, 0xB089C2, 0x7EAA94];
var round = 1;
var bubbles = [];

// Home page
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

setInterval(function(){
    bubbles = [];
    console.log('Round ' + round + ' !');

    players.forEach(function(element){
        var newBubble = {
            id: element.id,
            positionX: getRandomInt(-10,10),
            positionY: getRandomInt(-5,5),
            color: element.color
        };
        bubbles.push(newBubble);
    });
    console.log(bubbles);

    var bubbleInfos = {
        round: round,
        bubbles: bubbles
    };

    io.emit('timer', bubbleInfos);
    round++;
}, 5*1000);

io.sockets.on('connection', function (socket, pseudo) {

    /** 2 - Nouveau client */
    socket.on('nouveau_client', function(pseudo) {
        // Recuperation des infos
        pseudoSecure = ent.encode(pseudo);

        socket.infos = {};
        socket.infos.id = currentId;
        socket.infos.color = color[currentId % 6];
        socket.infos.pseudo = pseudoSecure;
        socket.infos.positionX = 0;
        socket.infos.positionY = 0;
        socket.infos.score = 0;

        currentId++;

        // Ajout du player au tableau des joueurs
        players.push(socket.infos);

        //Infos a envoyer
        var serverInfos = {};
        serverInfos.players = players;
        serverInfos.new = socket.infos;

        // Check
        console.log('Nouveau user : ' + pseudoSecure + ' !');
        console.log(players);

        socket.broadcast.emit('nouveau_client', serverInfos);
        socket.emit('me', serverInfos);
    });

    /** 3 - Message */
    socket.on('message', function (message) {
        if(socket.infos != undefined){
            typeMessage = message.type;
            contentMessage = message.content;

            var gapMove = 2;
            var minX = -12;
            var maxX = 12;
            var minY = -7;
            var maxY = 7;
            switch(message.content){
                case 'Gauche':
                    if(socket.infos.positionX > minX){
                        socket.infos.positionX -= gapMove;
                    }
                    break;
                case 'Haut':
                    if(socket.infos.positionY < maxY){
                        socket.infos.positionY += gapMove;
                    }
                    break;
                case 'Droite':
                    if(socket.infos.positionX < maxX){
                        socket.infos.positionX += gapMove;
                    }
                    break;
                case 'Bas':
                    if(socket.infos.positionY > minY){
                        socket.infos.positionY -= gapMove;
                    }
                    break;
            }

            io.emit('message', {infos: socket.infos, content: contentMessage});
        } else{
            console.log('Socket undefined in message');
        }
    });

    /** Final - Deconnexion */
    socket.on('disconnect', function() {
        if(socket.infos != undefined){
            console.log('Player disconnect ! Id : ' + socket.infos.id);

            var idToRemove = players.indexOf(socket.infos);
            players.splice(idToRemove, 1);

            var serverInfos = {};
            serverInfos.players = players;
            serverInfos.deco = socket.infos;

            io.emit('deco_client', serverInfos);
        } else{
            console.log('Socket undefined in disconnect');
        }
    });

});

function getRandomInt(min, max) {
    min = Math.ceil(min / 2);
    max = Math.floor(max / 2);
    result = (Math.floor(Math.random() * (max - min)) + min) * 2;
    return result;
}

server.listen(process.env.PORT || 8080);
