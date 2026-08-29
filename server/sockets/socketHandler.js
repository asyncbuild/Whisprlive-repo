import jwt from "jsonwebtoken";

export function initializeSockets(io, prisma) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            socket.user = null;
            return next();
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            socket.user = null;
            next();
        }
    });

    io.on("connection", (socket) => {
        const userLabel = socket.user?.username || socket.user?.id || "Participant";
        console.log(`Socket connected: ${socket.id} (${userLabel})`);

        const handleJoin = async (roomCode) => {
            try {
                const room = await prisma.room.findFirst({
                    where: { roomCode },
                });
                if (!room) {
                    console.log(`Unauthorized or invalid join attempt for room [${roomCode}]`);
                    return socket.emit("error_msg", "Room not found.");
                }

                socket.join(roomCode);
                console.log(`Socket joined room channel: ${roomCode} (${userLabel})`);
                socket.emit("joined_success", { message: `Joined room ${roomCode} successfully`, roomCode });
            } catch (err) {
                console.error(`Error during joinRoom for room [${roomCode}]:`, err);
                socket.emit("error_msg", "Server error while trying to join the room.");
            }
        };

        socket.on("joinRoom", handleJoin);
        socket.on("join_room", handleJoin);

        socket.on("disconnect", () => {
            console.log(`Socket ${socket.id} disconnected`);
        });
    });
}
