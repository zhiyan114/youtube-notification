'use strict';
/**
 * Module dependencies.
 */
import EventEmitter from 'events';
import server from './server'
import axois from 'axios';
import urllib from 'url';
import qs from 'querystring';
import crypto from 'crypto';
import xmlbodyparser from './xmlParser';
import {Express, Request, Response} from 'express';


// Type Definition
export type NotifierOptions = {
  hubCallback: string;
  secret?: string;
  middleware: boolean;
  port?: number;
  path?: string;
  hubUrl?: string;
}
/**
 * Constants
 */
const base_topic = 'https://www.youtube.com/xml/feeds/videos.xml?channel_id=';

/**
 * Represents the YouTube Notifier Class
 * @extends {EventEmitter}
 */
export default class YouTubeNotifier extends EventEmitter {
  public options: NotifierOptions;
  private server: Express | null;
  private _recieved: string[];
  /**
   * @typedef {Object} NotifierOptions
   * @property {string} hubCallback Your ip/domain name that will be used as a callback URL by the hub
   * @property {?string} [secret=undefined] The secret for the requests to hub
   * @property {boolean} [middleware=false] If you are going to use the Notifier with a middleware
   * @property {?number} [port=3000] An open port on your system to listen on. Defaults to port 3000 or undefined
   * @property {?string} [path='/'] The path on which server will interact with the hub
   * @property {?string} [hubUrl='https://pubsubhubbub.appspot.com/'] The hub url. It is advised not to change this.
   */

  /**
   * @since 1.0.0
   * @constructor
   * @param {NotifierOptions} [options={}] The options for the notifier
   */
  constructor(options: NotifierOptions) {
    if (!options.hubCallback) throw new Error('You need to provide the callback URL.');
    super();
    this.options = options;
    /**
     * The options the notifier was instantiated with.
     * @since 1.0.0
     * @name YouTubeNotifier#options
     * @type {NotifierOptions}
     */

    /**
     * The ip/domain name that will be used as a callback URL by the hub
     * @since 1.0.0
     * @type {string}
     */
    this.options.hubCallback = options.hubCallback;

    /**
     * The hub URL
     * @since 1.0.0
     * @type {string}
     */
     this.options.hubUrl = options.hubUrl || 'https://pubsubhubbub.appspot.com/';

    /**
     * The secretkey for the requests to hub
     * @since 1.0.0
     * @type {?string}
     */
     this.options.secret = options.secret;

    /**
     * If the notifier will be used with a middleware
     * @since 1.0.0
     * @type {boolean}
     */
     this.options.middleware = Boolean(options.middleware);

    /**
     * The port to listen on
     * @since 1.0.0
     * @type {number}
     */
     this.options.port = options.port || 3000;

    /**
     * The path on which server will interact with the hub
     * @since 1.0.0
     * @type {string}
     */
     this.options.path = options.path || '/';

    /**
     * The server to interact with the hub
     * @since 1.0.0
     * @type {Express|null}
     */
    this.server = null;

    /**
     * Array of recieved channels to ignore duplicate update for
     * @since 1.1.0
     * @private
     * @type {string[]}
     */
    this._recieved = [];
  }

  /**
   * Create a server and start listening on the port.
   *
   * This should not be used if you are using middleware.
   * @since 1.0.0
   */
  setup() {
    if (this.options.middleware) throw new Error('You cannot setup a server if you are using middleware.');
    if (this.server) throw new Error('The Server has been already setup.');
    this.server = server(this);
    this.server.listen(this.options.port);
  }

  /**
   * Creates an Express middleware handler for PubSubHubbub
   *
   * @param  {Object}   req HTTP request object
   * @param  {Object}   res HTTP response object
   * @return {Function} Middleware handler
   */
  listener() {
    return (req: Request, res: Response) => {
      xmlbodyparser(req, res, this);
    };
  }

  /**
   * Subsribe to a channel.
   * @since 1.0.0
   * @param {string[]|string} channels The channel id or an array of channel ids to subscribe to
   */
  subscribe(channels: string[] | string) {
    if (
      !channels ||
      (typeof channels !== 'string' && !Array.isArray(channels))
    ) {
      throw new Error(
        'You need to provide a channel id or an array of channel ids.',
      );
    }
    if (typeof channels === 'string') {
      this._makeRequest(channels, 'subscribe');
    } else {
      channels.forEach(channel => this._makeRequest(channel, 'subscribe'));
    }
  }

  /**
   * Unsubsribe from a channel.
   * @since 1.0.0
   * @param {string[]|string} channels The channel id or an array of channel ids to unsubscribe from
   */
  unsubscribe(channels: string[] | string) {
    if (
      !channels ||
      (typeof channels !== 'string' && !Array.isArray(channels))
    ) {
      throw new Error(
        'You need to provide a channel id or an array of channel ids.',
      );
    }
    if (typeof channels === 'string') {
      this._makeRequest(channels, 'unsubscribe');
    } else {
      channels.forEach(channel => this._makeRequest(channel, 'unsubscribe'));
    }
  }

  /**
   * Subsribe or unsubscribe to a channel
   * @since 1.0.0
   * @private
   * @param {string} channel_id The id of the channel to subscribe or unsubscribe to
   * @param {string} type Either 'subscribe' or 'unsubscribe'
   */
  
  _makeRequest(channel_id: string, type: string) {
    const topic = base_topic + channel_id;
    // Internal Types
    type makeReq = {
      'hub.callback': string;
      'hub.mode': string;
      'hub.topic': string;
      'hub.secret'?: string;
    }
    const data : makeReq = {
      'hub.callback': this.options.hubCallback,
      'hub.mode': type,
      'hub.topic': topic,
    };

    if (this.options.secret) data['hub.secret'] = this.options.secret;

    axois.post(this.options.hubUrl!, qs.stringify(data), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Request handler. Will be fired when a hub opens a connection to the server
   * @since 1.0.0
   * @event
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  _onRequest(req: Request, res: Response) {
    if (req.method === 'GET') {
      this._onGetRequest(req, res);
    } else if (req.method === 'POST') {
      this._onPostRequest(req, res);
    } else {
      // Reject any other methods
      return res.sendStatus(403);
    }
  }

  /**
   * GET request handler for the server. This should be called when the server
   * tries to verify the intent of the subscriber.
   * @since 1.0.0
   * @event
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  _onGetRequest(req: Request, res: Response) {
    let params = urllib.parse(req.url, true, true).query;

    // Invalid request
    if (!params['hub.topic'] || !params['hub.mode']) {
      return res
        .status(400)
        .set('Content-Type', 'text/plain')
        .end('Bad Request');
    }

    res
      .status(200)
      .set('Content-Type', 'text/plain')
      .end(params['hub.challenge']);
    type getReqData = {
      type: string | string[];
      channel: string;
      lease_seconds?: string | string[];
    }
    const data: getReqData = {
      type: params['hub.mode'],
      channel: (params['hub.topic'] as string).replace(base_topic, ''),
    };

    // Also return lease_seconds if mode is subscribe
    if (params['hub.lease_seconds']) data.lease_seconds = params['hub.lease_seconds'];

    this.emit(params['hub.mode'] as string, data);
  }

  /**
   * POST request handler. Should be called when the hub tries to notify the subscriber
   * with new data
   * @since 1.0.0
   * @event
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  _onPostRequest(req: any, res: Response) {
    let signatureParts, algo, signature, hmac;

    // Invalid POST
    if (this.options.secret && !req.headers['x-hub-signature']) {
      return res.sendStatus(403);
    }

    // Deleted Video
    if (req.body.feed['at:deleted-entry']) return res.sendStatus(200);

    let body = req.body.feed.entry;
    // Invalid Entry
    if (!body) {
      return res
        .status(400)
        .set('Content-Type', 'text/plain')
        .end('Bad Request');
    }
    body = body[0];
    let { rawBody } = req;

    // Match Secret
    if (this.options.secret) {
      signatureParts = req.headers['x-hub-signature'].split('=');
      algo = (signatureParts.shift() || '').toLowerCase();
      signature = (signatureParts.pop() || '').toLowerCase();

      try {
        hmac = crypto.createHmac(algo, this.options.secret);
      } catch (E) {
        return res.sendStatus(403);
      }

      hmac.update(rawBody);

      // Return a 200 response even if secret did not match
      if (hmac.digest('hex').toLowerCase() !== signature) {
        return res.sendStatus(200);
      }
    }

    let vidId = body['yt:videoid'][0];
    let publishTime = new Date(body.published[0]);
    let updateTime = new Date(body.updated[0]);

    if (this._recieved.includes(vidId)) {
      this._recieved.splice(this._recieved.indexOf(vidId), 1);
      return res.sendStatus(200);
    }

    if (updateTime.getTime() - publishTime.getTime() < 300000) {
      this._recieved.push(vidId);
    }

    let data = {
      video: {
        id: vidId,
        title: body.title[0],
        link: body.link[0].$.href,
      },
      channel: {
        id: body['yt:channelid'][0],
        name: body.author[0].name[0],
        link: body.author[0].uri[0],
      },
      published: publishTime,
      updated: updateTime,
    };

    this.emit('notified', data);

    res.sendStatus(200);
  }
}
