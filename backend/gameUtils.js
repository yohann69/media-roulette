function calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes) {
    const room = gameManager.getRoom(pin);
    if (!room) return;

    const actualOwnerId = room.currentMediaOwnerId || room.players[0].socketId;
    const roundStartTime = roundStartTimes.get(pin) || Date.now();
    
    const roundResults = gameManager.calculateRoundResults(
        pin,
        actualOwnerId,
        roundStartTime
    );

    io.to(pin).emit("round-result", roundResults);

    if (room.currentRound >= room.settings.rounds) {
        gameManager.updateGameState(pin, "finished");
        setTimeout(() => {
            io.to(pin).emit("game-finished", {
                leaderboard: gameManager.getPlayerScores(pin),
            });
        }, 3000);
    } else {
        setTimeout(() => {
            gameManager.setCurrentRound(pin, room.currentRound + 1);
            startNewRound(pin, io, gameManager, roundStartTimes);
        }, 5000);
    }
}

function startNewRound(pin, io, gameManager, roundStartTimes) {
    const room = gameManager.getRoom(pin);
    if (!room) return;

    const media = gameManager.getRandomMedia(pin);
    if (!media) {
        io.to(pin).emit("error", { message: "No media available" });
        return;
    }

    const roundStartTime = Date.now();
    roundStartTimes.set(pin, roundStartTime);

    room.currentMediaIndex = media.index;
    room.currentMediaOwnerId = media.ownerId;

    const options = room.players.map((p) => ({
        id: p.socketId,
        name: p.name,
    }));

    io.to(pin).emit("new-round", {
        round: room.currentRound,
        totalRounds: room.settings.rounds,
        mediaData: {
            id: media.id,
            uri: media.uri || media.base64,
            base64: media.base64,
            mediaType: media.mediaType,
        },
        duration: room.settings.timer,
        options,
        roundStartTime,
    });

    console.log(`Round ${room.currentRound} started for game ${pin}`);
}

module.exports = { calculateAndEmitRoundResults, startNewRound };

