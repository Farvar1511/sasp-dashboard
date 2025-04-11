const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());

app.post('/assign-task', (req, res) => {
    const { userId, task, adminId } = req.body;

    // Load users
    const users = JSON.parse(fs.readFileSync('./users.json', 'utf-8'));
    const admin = users.find(user => user.id === adminId);

    const requiredRanks = ["SSgt.", "Commander", "Captain", "Lieutenant", "Commissioner"];
    if (!admin || !requiredRanks.includes(admin.rank)) {
        return res.status(403).json({ error: "Access denied" });
    }

    const user = users.find(user => user.id === userId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    user.tasks.push(task);

    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
    res.json({ message: "Task assigned successfully" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});