import cloudscraper
import json

def download_god_roll_data():
    url = "https://www.light.gg/god-roll/roll-appraiser/data/"

    scraper = cloudscraper.create_scraper()
    try:
        response = scraper.get(url)
        response.raise_for_status()

        # Parse the JSON response
        data = response.json()

        # Save the data to a file named 'lightgg.json'
        with open('backend/light/rollAppraiserData.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)

        print("Successfully downloaded and saved the data to backend/light/rollAppraiserData.json")

    except Exception as e:
        # cloudscraper can raise its own specific exceptions, but a general
        # catch-all is fine here.
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    download_god_roll_data()
