# Taiko Transaction Bot

Bu Taiko da günlük olarak hacim botudur, rutin bir bottur, görevi 50 tane wrap ve 50 tane unwrap işlemi yapar ve bu işlemleri 5 saatlik rastgele bir zamanda yapar.

## Prerequisite

To run this bot you need to:

- Node.js Installed.


## Set Up

### Step-by-Step Instructions

1. **Update the package lists:**

    ```sh
    sudo apt-get update
    ```

2. **Install git:**

    ```sh
    sudo apt-get install git
    ```

3. **Clone the repository:**

    ```sh
    git clone https://github.com/TastasMete/TaikoBot.git
    ```

4. **Navigate to the project directory:**

    ```sh
    cd TaikoBot
    ```

5. **Install Node.js (if not already installed):**

    ```sh
    sudo apt-get install nodejs
    ```
    ```sh    
    sudo apt-get install npm
    ```

6. **Install the project dependencies:**

    ```sh
    npm install
    ```

7. **Create a `.env` file in the project directory and add your address & private key:**

    
    ```sh
    echo "PRIVATE_KEY=your_private_key_here" > .env
    ```

## Running the Bot

### One-time Run

To run the bot once:

```sh
npm run start
```
### Scheduled Run

To set up the bot to run every day at 08.30 AM UTC, follow these steps:

1.	Make the setup-cron.sh script executable:
 ```sh
chmod +x setup-cron.sh
```
2.	Run the setup-cron.sh script:
```sh
./setup-cron.sh
```
## CONTRIBUTE

Feel free to fork and contribute adding more feature thanks.

## SUPPORT
Each tx contain tiny amount of tax to support next Bot with various features


