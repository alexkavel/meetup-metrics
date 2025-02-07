require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { WebClient } = require('@slack/web-api');

class MeetupScraper {
  constructor(isTestMode = true) {
    this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.channel = isTestMode ? 'test' : 'general';
    this.previousMetrics = null;
    this.groupUrl = 'https://www.meetup.com/producttank-cardiff';
  }

  async scrapeMetrics() {
    try {
      const response = await axios.get(this.groupUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      
      // Get member count
      const memberLink = $('a').filter(function() {
        return $(this).text().includes('members');
      }).first();
      const memberText = memberLink.text();
      const memberCount = memberText.split('·')[0].trim().replace(/[^0-9]/g, '');

      // Get next event attendees
      const attendeeSpan = $('.text-gray6 span:contains("attendees")').first();
      const attendeeCount = attendeeSpan ? 
        parseInt(attendeeSpan.text().split(' ')[0]) : 
        null;

      // Get next event title
      const nextEventTitle = $('.ds-font-title-3').first().text();
      
      return {
        memberCount,
        nextEvent: {
          title: nextEventTitle,
          attendees: attendeeCount
        }
      };
    } catch (error) {
      console.error('Scraping failed:', error);
      throw error;
    }
  }

  formatMessage(metrics) {
    let message = '📊 *ProductTank Cardiff Metrics*\n';
    message += `• Members: ${metrics.memberCount}\n`;
    
    if (metrics.nextEvent?.attendees) {
      message += `\n*Next Event: ${metrics.nextEvent.title}*\n`;
      message += `• Current RSVPs: ${metrics.nextEvent.attendees}`;
    }
    
    return message;
  }

  async postToSlack(message) {
    try {
      await this.slack.chat.postMessage({
        channel: this.channel,
        text: message,
        parse: 'mrkdwn'
      });
      console.log('Posted to Slack successfully');
    } catch (error) {
      console.error('Slack posting failed:', error);
      throw error;
    }
  }

  async run() {
    try {
      const metrics = await this.scrapeMetrics();
      const message = this.formatMessage(metrics);
      await this.postToSlack(message);
    } catch (error) {
      console.error('Script failed:', error);
      await this.postToSlack('⚠️ Failed to retrieve metrics');
    }
  }
}

// Run the script
const scraper = new MeetupScraper(true);
scraper.run();
