
#* 🐙 Use the official Puppeteer image as the base image
FROM ghcr.io/puppeteer/puppeteer:latest

#* 🐙 Set environment variables to skip Chromium download and specify the path to Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \ PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

#* 🐙 Change to root user to install dependencies
USER root

#* 🐙 Install pnpm
RUN npm install -g pnpm

#* 🐙 Setup working directory
WORKDIR /usr/src/app

#* 🐙 Copy package.json
COPY package*.json ./

#* 🐙 Install dependencies
RUN pnpm install

#* 🐙 Copy the rest of the application code
COPY . .

#* 🐙 Expose the application port: 3000
EXPOSE 3000

#* 🐙 Change back to the default user for security
USER pptruser

#* 🐙 Start the Kurage-API
CMD ["node", "server.js"]