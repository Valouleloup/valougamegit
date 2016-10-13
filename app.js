var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    ent = require('ent'),
    fs = require('fs');

// Dossier root fichiers
app.use(express.static(__dirname + '/'));

// Variable d'etat du jeu
var ATTENTE = 0;
var READY = 1;
var PLAY = 10;
var RESULTATS = 20;
var RESET = 30;
var etatJeu = ATTENTE;
var pointsActive = false;

// Init variables
var players = [];
var currentId = 0;
var color = [0xF5C15F, 0x4CCE73, 0x87A9F2, 0xE66D5F, 0xB089C2, 0x7EAA94];
var round = 0;
var bubbles = [];
var winners = [];
var dateDebutRound;

// Home page
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

setInterval(function(){

    if(etatJeu == ATTENTE){

        console.log('*** Attente ***');

        resetTabs();
        createBubbles();

        // Si les joueurs sont prets, on passe à l'etape ready
        if(arePlayersReady()){
            etatJeu = READY;
            console.log("Etat partie : ready !");
        }

    } else if(etatJeu == READY){

        console.log('*** Ready ***');

        resetTabs();

        resetPlayersScores();

        io.emit('new_game', players);

        etatJeu = PLAY;

    } else if(etatJeu == PLAY){

        console.log('*** Play ***');

        resetTabs();
        createBubbles();

        pointsActive = true;

        round++;

        if(round > 10){
            etatJeu = RESULTATS;
        }
    } else if(etatJeu == RESULTATS){

        console.log('*** Resultats ***');

        resetTabs();

        pointsActive = false;

        io.emit('end_game', players);

        etatJeu = RESET;

    } else if(etatJeu == RESET){

        console.log('*** Reset ***');

        resetTabs();

        setPlayersWait();

        round = 0;

        io.emit('reset_game', players);

        etatJeu = ATTENTE;

    }

    console.log('Round ' + round + ' !');

    // On ajoute une bulle par joueur

    var bubbleInfos = {
        round: round,
        bubbles: bubbles
    };

    // On definit la date de debut du round
    dateDebutRound = new Date();

    // On envoit les infos des bulles et du round
    io.emit('timer', bubbleInfos);

}, 5*1000);

// Les joueurs sont prets ?
function arePlayersReady(){

    var force = 0;
    var go = 0;

    if(players.length > 1){
        go = 1;
    }

    players.forEach(function(element){
        console.log('Joueur ' + element.pseudo + ' pret ? ' + element.score);
        if(element.score != 'pret'){
            go = 0;
        }
        if(element.score == 'force'){
            force = 1;
        }
    });

    return go || force;

}

// On retablit les variables pour chaque round
function resetTabs(){
    bubbles = [];
    winners = [];
}

// On cree les bulles pour chaque round
function createBubbles(){

    players.forEach(function(element){
        var newBubble = {
            id: element.id,
            positionX: getRandomInt(-10,10),
            positionY: getRandomInt(-5,5),
            color: element.color
        };
        bubbles.push(newBubble);
    });

}

// On retablit les scores
function resetPlayersScores(){

    players.forEach(function(element){
       element.score = 0;
    });

    console.log('Scores reset !');

}

// On retablit les scores
function setPlayersWait(){

    players.forEach(function(element){
        element.score = 'attente';
    });

    console.log('Scores attente !');

}

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
        if(pointsActive == true){
            socket.infos.score = 0;
        } else{
            socket.infos.score = 'attente';
        }

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

    /** 2.1 - Ready */
    socket.on('player_ready', function(ready){

        // Le joueur est pret
        socket.infos.score = ready.etat;

        // On transmet aux autres joueurs
        io.emit('player_ready', players);

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

            // Trouve la bubble associee
            var bubAssociee = bubbles.filter(function(bub) {
                return bub.id === socket.infos.id;
            })[0];

            // Si les positions sont égales, on augmente les points du joueur
            if((bubAssociee != undefined) &&(socket.infos.positionX == bubAssociee.positionX && socket.infos.positionY == bubAssociee.positionY)){

                // On recupere le temps mit par le joueur
                var dateSuccess = new Date();
                var tempsSuccess = Math.abs(dateSuccess - dateDebutRound)/1000;
                console.log(tempsSuccess);

                // Attribution des points
                if(pointsActive == true){
                    switch(winners.length){
                        case 0:
                            socket.infos.score += 3;
                            winners.push(socket.infos.pseudo);
                            console.log(socket.infos.pseudo + " : +3 points !");
                            break;
                        case 1:
                            socket.infos.score += 2;
                            winners.push(socket.infos.pseudo);
                            console.log(socket.infos.pseudo + " : +2 points !");
                            break;
                        case 2:
                            socket.infos.score += 1;
                            winners.push(socket.infos.pseudo);
                            console.log(socket.infos.pseudo + " : +1 points !");
                            break;
                    }
                }

                // On enleve la bulle du tablea des bulles
                var idBubToRemove = bubbles.indexOf(bubAssociee);
                bubbles.splice(idBubToRemove, 1);

                // On renvoit les joueurs pour le panel et le joueur gagnant pour enlever l'affichage de sa bulle
                var infosSuccess = {
                    players: players,
                    success: socket.infos,
                    temps: tempsSuccess
                };

                io.emit('success', infosSuccess);
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
