// File: verifier.js
import axios from "axios";
import os from "os";

function getHWID() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (!config.internal && config.mac !== "00:00:00:00:00:00") {
        return config.mac.toUpperCase();
      }
    }
  }
  return null;
}

export async function validateToken(TOKEN) {
  const hwid = getHWID();
  if (!hwid) {
    console.error("Unable to get MAC address");
    return 0;
  }

  try {
    const response = await axios.post("http://localhost:3000/validate-token", {
      token: TOKEN,
      hwid: hwid,
    });

    if (response.data.valid) {
      console.log("✅ Token is valid");
      return response.data.maxProxies;
    } else {
      console.log("❌ Token is invalid");
      return 0;
    }
  } catch (err) {
    console.error("Error validating token:", err.response?.data || err.message);
    return 0;
  }
}
