# UK Wholesale Aytac-Style Admin Project

## Run
npm install
npm run seed
npm start

Open:
http://localhost:3000

## Admin Login
Email: admin@example.com
Password: admin123

## New Changes
- Aytac-style blue header
- Search modal with product live search
- Suggestions panel
- Catalogue red strip
- Mobile top bar/menu
- Login page redesigned like screenshot
- Register page redesigned
- Product image upload admin dashboard
- Category, banner and order management

## If admin login says invalid
Delete old database, then seed again:

PowerShell:
Remove-Item data\database.sqlite -Force
Remove-Item data\sessions.sqlite -Force
npm run seed
npm start
