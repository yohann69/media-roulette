function calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes) {
    const room = gameManager.getRoom(pin);
    if (!room) return;

    // Prevent duplicate calculations for the same round
    if (room.roundResultsCalculated) {
        console.log(`Round results already calculated for round ${room.currentRound} in game ${pin}`);
        return;
    }

    // Mark as calculated before processing to prevent race conditions
    room.roundResultsCalculated = true;

    const actualOwnerId = room.currentMediaOwnerId || room.players[0].socketId;
    const roundStartTime = roundStartTimes.get(pin) || Date.now();
    
    const roundResults = gameManager.calculateRoundResults(
        pin,
        actualOwnerId,
        roundStartTime
    );

    io.to(pin).emit("round-result", roundResults);

    // Don't auto-advance - wait for the owner to click continue
    // The next round will start when the owner calls continue-game
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
    gameManager.updateActivity(pin); // Track activity on new round

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
        actualOwnerId: room.currentMediaOwnerId, // Send owner ID so clients can disable selection
    });

    console.log(`Round ${room.currentRound} started for game ${pin}`);
}

module.exports = { calculateAndEmitRoundResults, startNewRound };
