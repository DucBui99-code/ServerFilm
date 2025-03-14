# Sử dụng image Node.js Alpine để giảm kích thước
FROM node:18-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json và package-lock.json
COPY package.json package-lock.json ./

# Cài đặt dependencies sử dụng npm ci
RUN npm ci

# Copy toàn bộ mã nguồn vào container
COPY . .

# Thiết lập biến môi trường (nếu cần)
ENV NODE_ENV=production

# Expose cổng mà app sẽ chạy
EXPOSE 8000

# Chuyển sang sử dụng user node để tăng bảo mật
USER node

# Chạy ứng dụng
CMD ["node", "app.js"]