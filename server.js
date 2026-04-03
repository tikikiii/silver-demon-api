const express = require("express");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "CHANGE_THIS_PASSWORD";

let database = {};
try {
    database = JSON.parse(fs.readFileSync("keys.json"));
} catch {
    database = {};
}

function saveDB() {
    fs.writeFileSync("keys.json", JSON.stringify(database, null, 2));
}

// VERIFY
app.get("/verify", (req, res) => {
    const { key, hwid } = req.query;
    const data = database[key];

    if (!data) return res.json({ valid: false });

    if (data.banned) {
        return res.json({ valid: false, reason: "banned" });
    }

    if (data.expires && Date.now() > data.expires) {
        delete database[key];
        saveDB();
        return res.json({ valid: false, reason: "expired" });
    }

    if (!data.hwid) {
        data.hwid = hwid;
    }

    if (data.hwid !== hwid) {
        return res.json({ valid: false, reason: "hwid_mismatch" });
    }

    saveDB();
    res.json({ valid: true });
});

// GENERATE
app.get("/generate", (req, res) => {
    const { admin, days } = req.query;

    if (admin !== ADMIN_PASSWORD) {
        return res.json({ error: "Unauthorized" });
    }

    const key = "SD-" + Math.random().toString(36).substring(2,10).toUpperCase();
    const expireTime = Date.now() + (parseInt(days) || 1) * 86400000;

    database[key] = {
        hwid: null,
        expires: expireTime,
        banned: false
    };

    saveDB();
    res.json({ key });
});

// DELETE
app.get("/delete", (req, res) => {
    const { admin, key } = req.query;

    if (admin !== ADMIN_PASSWORD) {
        return res.json({ error: "Unauthorized" });
    }

    delete database[key];
    saveDB();

    res.json({ success: true });
});

// DASHBOARD
app.get("/dashboard", (req, res) => {
    const { admin } = req.query;

    if (admin !== ADMIN_PASSWORD) {
        return res.send("Unauthorized");
    }

    let html = `
    <html>
    <body style="background:#111;color:white;font-family:Arial;padding:20px">
    <h1>💎 Silver Demon Dashboard</h1>

    <input id="days" placeholder="Days">
    <button onclick="gen()">Generate</button>

    <script>
    async function gen(){
        let d = document.getElementById("days").value || 1;
        let res = await fetch("/generate?admin=${ADMIN_PASSWORD}&days="+d);
        let data = await res.json();
        alert("Key: "+data.key);
        location.reload();
    }

    async function del(k){
        await fetch("/delete?admin=${ADMIN_PASSWORD}&key="+k);
        location.reload();
    }
    </script>
    `;

    for (let key in database) {
        let k = database[key];
        let exp = new Date(k.expires).toLocaleString();

        html += `
        <div style="background:#222;padding:10px;margin:10px;border-radius:8px">
        ${key}<br>
        HWID: ${k.hwid || "none"}<br>
        Exp: ${exp}<br>
        <button onclick="del('${key}')">Delete</button>
        </div>
        `;
    }

    html += "</body></html>";
    res.send(html);
});

app.listen(PORT, () => console.log("Server running"));