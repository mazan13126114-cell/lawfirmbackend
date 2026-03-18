# lawfirmbackend



## 📝 Description

LawFirmBackend is a robust and scalable server-side application built with Express.js, designed specifically to power the digital operations of modern legal practices. This backend solution provides a secure and efficient infrastructure for managing client records, case documentation, and scheduling, ensuring seamless data flow for web-based legal management platforms.

## ✨ Features

- 🕸️ Web


## 🛠️ Tech Stack

- 🚀 Express.js


## 📦 Key Dependencies

```
axios: ^1.13.2
bcryptjs: ^2.4.3
cors: ^2.8.5
dotenv: ^16.3.1
express: ^4.18.2
express-rate-limit: ^7.1.5
express-validator: ^7.0.1
helmet: ^7.1.0
jsonwebtoken: ^9.0.2
mysql2: ^3.6.5
nodemailer: ^7.0.10
```

## 🚀 Run Commands

- **dev**: `npm run dev`
- **start**: `npm run start`
- **prisma**: `npm run prisma`
- **prisma:generate**: `npm run prisma:generate`
- **prisma:migrate**: `npm run prisma:migrate`
- **prisma:studio**: `npm run prisma:studio`


## 📁 Project Structure

```
.
├── package.json
├── prisma
│   ├── migrations
│   │   ├── 20251119050141_init
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── readme.md
└── src
    ├── config
    │   └── prisma.js
    ├── controllers
    │   ├── adminController.js
    │   ├── aiController.js
    │   ├── authController.js
    │   ├── caseController.js
    │   ├── chatController.js
    │   └── lawyerController.js
    ├── middleware
    │   ├── auth.js
    │   ├── errorHandler.js
    │   └── validation.js
    ├── routes
    │   ├── adminRoutes.js
    │   ├── aiRoutes.js
    │   ├── authRoutes.js
    │   ├── caseRoutes.js
    │   ├── chatRoutes.js
    │   └── lawyerRoutes.js
    ├── server.js
    └── utils
        ├── aiService.js
        └── jwt.js
```

## 👥 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/mazan13126114-cell/lawfirmbackend.git`
3. **Create** a new branch: `git checkout -b feature/your-feature`
4. **Commit** your changes: `git commit -am 'Add some feature'`
5. **Push** to your branch: `git push origin feature/your-feature`
6. **Open** a pull request

Please ensure your code follows the project's style guidelines and includes tests where applicable.

---
*This README was generated with ❤️ by ReadmeBuddy*
