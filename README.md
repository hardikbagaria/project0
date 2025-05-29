## License
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

This software is proprietary and protected by a custom license. See the [LICENSE](./LICENSE) file for full terms.


# DupeBot License & Proxy Management System

A secure embedded system for distributing a Minecraft dupe bot using a license-based access model. Includes an encrypted executable, hardware-bound token authentication, and dynamic proxy management via a protected Node.js API.

---

## 🔐 Features

1. **Token-Based Licensing**  
   - License tokens are tied to hardware IDs (HWID) to prevent sharing and abuse.
   - Admin panel allows secure token generation and control.

2. **Encrypted Executable (EXE)**  
   - Distributed as a secure binary to prevent reverse engineering.
   - Communicates with backend for real-time token validation and proxy allocation.

3. **Dynamic Proxy Allocation**  
   - Users are allocated proxies based on their token’s max limit.
   - Proxies are uniquely bound to tokens, ensuring no overlap or double usage.

4. **Admin Panel**  
   - Token creation endpoint secured by authentication.
   - Manage token limits and license info through RESTful API.

5. **Scalable Pricing Structure**  
   - Base package: $5 (includes 2 proxies + dupe bot access).
   - Additional proxies available at $2 each.

6. **Fully Backend-Enforced Limits**  
   - Users cannot exceed their proxy allocation.
   - Proxy availability and limits are controlled server-side for full protection.

7. **Built with Node.js & SQLite3**  
   - Lightweight and easy to deploy.
   - Simple database structure with reliable file-based persistence.

---

## 🧪 Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite3
- **Security**: HWID-bound tokens, authenticated admin routes
- **Executable**: Encrypted binary with integrated API calls
- **API Features**:
  - `/add-token` – Add new tokens (admin only)
  - `/allocate-proxies` – Allocate proxies to a validated token
  - Additional endpoints for token validation and proxy management

---

## 💼 Deployment & Usage

1. **Admin creates a token** from a protected endpoint, specifying max proxies.
2. **User receives** the encrypted exe and token.
3. **Client requests** proxies using token; server responds with available slots.
4. **EXE starts duping**, limited to proxy count defined by the token.

---

## ⚖️ Legal Note

This project is shared for **educational and portfolio** purposes only. Distribution or commercial use of the dupe bot without appropriate authorization is prohibited.

---
