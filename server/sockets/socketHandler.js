import jwt from "jsonwebtoken";

export function initializeSockets(io, prisma) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            socket.user = null;
            return next();
        }
        try {
            const secret = process.env.JWT_SECRET;
            const decoded = jwt.verify(token, secret);
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

        if (socket.user?.id) {
            const userRoom = `user_${socket.user.id}`;
            socket.join(userRoom);
            console.log(`Socket joined user personal channel: ${userRoom} (${userLabel})`);
        }

        socket.on("join_user", (userId) => {
            // Security: Only allow verified authenticated sockets to join their own personal notifications channel
            if (socket.user?.id) {
                const targetId = userId === socket.user.id ? userId : socket.user.id;
                socket.join(`user_${targetId}`);
                console.log(`Socket joined user personal channel: user_${targetId}`);
            }
        });

        const handleJoin = async (roomCode) => {
            if (!roomCode) return;
            try {
                const room = await prisma.room.findFirst({
                    where: { OR: [{ roomCode }, { customSlug: roomCode }] },
                    select: { roomCode: true, customSlug: true }
                });
                if (!room) {
                    console.log(`Unauthorized or invalid join attempt for room [${roomCode}]`);
                    return socket.emit("error_msg", "Room not found.");
                }

                socket.join(room.roomCode);
                if (room.customSlug && room.customSlug !== room.roomCode) {
                    socket.join(room.customSlug);
                }
                console.log(`Socket joined room channel: ${room.roomCode} (slug: ${room.customSlug || "none"}) (${userLabel})`);
                socket.emit("joined_success", { message: `Joined room ${room.roomCode} successfully`, roomCode: room.roomCode });
            } catch (err) {
                console.error(`Error during joinRoom for room [${roomCode}]:`, err);
                socket.emit("error_msg", "Server error while trying to join the room.");
            }
        };

        socket.on("joinRoom", handleJoin);
        socket.on("join_room", handleJoin);

        // Live Reactions broadcast
        socket.on("send_reaction", async ({ roomCode, emoji }) => {
            if (!roomCode || !emoji) return;
            const allowedEmojis = ["👏", "❤️", "🔥", "💡", "🤯", "🎉", "👍", "🚀"];
            if (!allowedEmojis.includes(emoji)) return;

            const reactionPayload = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                emoji,
                timestamp: Date.now(),
            };

            // Emit to direct room code
            io.to(roomCode).emit("live_reaction", reactionPayload);

            // Also ensure lookup & broadcast to canonical room code / slug
            try {
                const room = await prisma.room.findFirst({
                    where: { OR: [{ roomCode }, { customSlug: roomCode }] },
                    select: { roomCode: true, customSlug: true }
                });
                if (room) {
                    if (room.roomCode && room.roomCode !== roomCode) {
                        io.to(room.roomCode).emit("live_reaction", reactionPayload);
                    }
                    if (room.customSlug && room.customSlug !== roomCode) {
                        io.to(room.customSlug).emit("live_reaction", reactionPayload);
                    }
                }
            } catch (e) {}
        });

        socket.on("disconnect", () => {
            console.log(`Socket ${socket.id} disconnected`);
        });
    });
}
