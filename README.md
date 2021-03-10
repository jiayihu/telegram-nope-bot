# nope-bot

A Telegram bot which tracks the value of [NOPE](http://nopechart.com/).

## Usage

The bot has currently the following commands:

- `/now GME` to get the current NOPE and price of the ticker `GME` (to the moon btw)
- `/track TSLA 30` to be notified when `Math.abs(NOPE) > 30`, which means NOPE < -30 or NOPE > 30
- `/untrack TSLA` to unsubscribe from previous notifications

## Development

To develop the bot locally, you must create an `.env` file with the Telegram bot token. Follow the steps in the [official doc](https://core.telegram.org/bots#3-how-do-i-create-a-bot).

You must create a new bot and get its API token, then you can test it locally by writing commands in the bot chat.

Example of `.env` file:

```
TELEGRAM_TOKEN=1111111:1111111tokentokentoken
```

To run locally:

```
npm run dev
```

To build and deploy the Docker image:

```
npm run build
docker build . --tag=IMAGE_NAME
docker push IMAGE_NAME
```

To deploy on Google Compute Engine (assuming a VM instance has been created):

```
gcloud compute instances update-container VM_NAME --container-image IMAGE_NAME
```
