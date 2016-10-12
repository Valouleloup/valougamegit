var app = require('express')(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    ent = require('ent'),
    fs = require('fs');

var players = [];
var currentId = 0;
var color = [0xF5C15F, 0x4CCE73, 0x87A9F2, 0xE66D5F];


app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket, pseudo) {

    /** 2 - Nouveau client */
    socket.on('nouveau_client', function(pseudo) {
        // Recuperation des infos
        pseudoSecure = ent.encode(pseudo);

        socket.infos = {};
        socket.infos.id = currentId;
        socket.infos.color = color[currentId % 4];
        socket.infos.pseudo = pseudoSecure;
        socket.infos.positionX = 0;
        socket.infos.positionY = 0;
        socket.infos.score = 0;

        currentId++;

        // Ajout du player
        players.push(socket.infos);

        //Infos a envoyer
        var serverInfos = {};
        serverInfos.players = players;
        serverInfos.me = socket.infos;

        // Check
        console.log('Nouveau user : ' + pseudoSecure + ' !');
        console.log(players);

        io.emit('nouveau_client', socket.infos);
        socket.emit('me', serverInfos);
    });

    /** 3 - Message */
    socket.on('message', function (message) {
        typeMessage = message.type;
        contentMessage = message.content;

        var gapMove = 2;
        switch(message.content){
            case 'Gauche':
                socket.infos.positionX -= gapMove;
                break;
            case 'Haut':
                socket.infos.positionY += gapMove;
                break;
            case 'Droite':
                socket.infos.positionX += gapMove;
                break;
            case 'Bas':
                socket.infos.positionY -= gapMove;
                break;
        }

        io.emit('message', {infos: socket.infos, content: contentMessage});
    });

});

server.listen(process.env.PORT || 8080);
