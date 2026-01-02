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

    // Get media by index for the current round
    const media = gameManager.getMediaForRound(pin, room.currentRound);
    
    if (!media) {
        // Should not happen if gameMedia is set up correctly
        io.to(pin).emit("error", { message: "No media available for this round" });
        return;
    }

    const roundStartTime = Date.now();
    roundStartTimes.set(pin, roundStartTime);

    room.currentMediaIndex = media.index; // Index in the gameMedia array
    room.currentMediaOwnerId = media.ownerId;

    const options = room.players.map((p) => ({
        id: p.socketId,
        name: p.name,
    }));

    // Send only the index (or ID) of the media, clients have it locally
    io.to(pin).emit("new-round", {
        round: room.currentRound,
        totalRounds: room.settings.rounds,
        mediaData: {
            id: media.id,
            index: media.index, // Used to find file locally
            mediaType: media.mediaType,
            // URI/Base64 not needed, clients load from local storage using ID/Index
        },
        duration: room.settings.timer,
        options,
        roundStartTime,
    });

    console.log(`Round ${room.currentRound} started for game ${pin}`);
}

module.exports = { calculateAndEmitRoundResults, startNewRound };
