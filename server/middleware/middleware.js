import jwt from 'jsonwebtoken';

export function verifyToken(req,res,next){
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];
    if(!token || token === "undefined" || token === "null" || token === "[object Object]"){
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    try {
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token is not valid or expired!' });
    }
}