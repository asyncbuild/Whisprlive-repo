import jwt from "jsonwebtoken";

export function initializeSockets(io, prisma) {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error: Token not provided"));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`Authenticated host connected: ${socket.id} (User: ${socket.user.username || socket.user.id})`);

        socket.on("joinRoom", async (roomCode) => {
            try {
                const room = await prisma.room.findFirst({
                    where: {
                        roomCode,
                        hostId: socket.user.id,
                    },
                });
                if (!room) {
                    console.log(`Unauthorized join attempt for room [${roomCode}] by user ${socket.user.id}`);
                    return socket.emit("error_msg", "Unauthorized: You do not own this room.");
                }

                socket.join(roomCode);
                console.log(`Host joined room channel: ${roomCode}`);
                socket.emit("joined_success", { message: `Joined room ${roomCode} successfully`, roomCode });
            } catch (err) {
                console.error(`Error during joinRoom for room [${roomCode}] by user ${socket.user.id}:`, err);
                socket.emit("error_msg", "Server error while trying to join the room.");
            }
        });

        socket.on("disconnect", () => {
            console.log(`Socket ${socket.id} disconnected`);
        });
    });
}
