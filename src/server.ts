'use strict';
/**
 * Module dependencies.
 */
const express = require('express');

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
export default function server(notifier) {
  app.use(notifier.path, notifier.listener());

  return app;
}

