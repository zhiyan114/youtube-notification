'use strict';
/**
 * Module dependencies.
 */
import express from 'express';
import YouTubeNotifier from './index';

/**
 * Setup the server
 */
const app = express();

/**
 * Returns the server.
 *
 * @param {YouTubeNotifier} notifier The notifier object
 * @return {Express} A new express server
 */
export default function server(notifier: YouTubeNotifier) {
  // The constructor will do checks and assign a default value automatically
  app.use(notifier.options.path!, notifier.listener());

  return app;
}

