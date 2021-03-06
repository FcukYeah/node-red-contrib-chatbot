var _ = require('underscore');
var validators = require('./validators');
var ChatContextStore = require('../chat-context-store');

module.exports = {


  when: function (param) {
    if (param != null && _.isFunction(param.then)) {
      return param;
    } else if (param != null) {
      return new Promise(function(resolve) {
        resolve(param);
      })
    }
    return new Promise(function(resolve, reject) {
      reject();
    });
  },

  /**
   * @method extractValue
   * Get values from node config or inbound message, node config always comes first
   * @param {String} type Type of value to search for
   * @param {String} name Name of variable (name in config and inbound payload must be the same)
   * @param {Object} node
   * @param {Object} message
   * @return {Any}
   */
  // eslint-disable-next-line max-params
  extractValue: function(type, name, node, message) {

    var validator = null;
    switch(type) {
      case 'buffer':
        validator = validators.buffer;
        break;
      case 'hash':
        validator = function(value) {
          // it's tricky, exclude any whole message if, which is an hash but contains messageId nad chatId
          // also the has could be nested in the payload, in that case if the payload has an attribute with the same
          // name os the variable I'm searching for, skip it
          return _.isObject(value) && value.chatId == null && value.messageId == null && value[name] == null;
        };
        break;
      case 'boolean':
        validator = validators.boolean;
        break;
      case 'string':
        validator = validators.string;
        break;
      case 'array':
        validator = validators.array;
        break;
      case 'buttons':
        validator = function(value) {
          return _.isArray(value) && !_.isEmpty(value) && _(value).all(function(button) {
            return button != null && button.type != null;
          });
        };
        break;
      default:
        // eslint-disable-next-line no-console
        console.log('Unable to find a validator for type \'' + type +'\' in extractValue');
    }

    // search in this order
    // 1. config
    // 2. payload variable
    // 3. if payload object has a key with the right type
    if (validator(node[name])) {
      return node[name];
    } else if (message.payload != null && validator(message.payload)) {
      return message.payload;
    } else if (_.isObject(message.payload) && validator(message.payload[name])) {
      return message.payload[name];
    }
    return null;
  },

  chainExtractors: function() {
  },

  /**
   * @method hasValidPayload
   * Check if the message has a valid payload for a sender
   * @return {String}
   */
  hasValidPayload: function(msg) {

    if (msg.payload == null) {
      return 'msg.payload is empty. The node connected to sender is passing an empty payload.';
    }
    if (msg.payload.chatId == null) {
      return 'msg.payload.chatId is empty. Ensure that a RedBot node is connected to the sender node, if the payload'
        + ' is the result of an elaboration from other nodes, connect it to a message node (text, image, etc.)';
    }
    if (msg.payload.type == null) {
      return 'msg.payload.type is empty. Unsupported message type.';
    }
    return null;
  },

  /**
   * @method getChatId
   * Extract a valid chatId from a message
   * @param {Object} msg
   * @return {String}
   */
  getChatId: function(msg) {
    if (_.isObject(msg.payload) && msg.payload.chatId != null) {
      return msg.payload.chatId;
    } else if (msg.originalMessage != null && msg.originalMessage.chatId != null) {
      return msg.originalMessage.chatId;
    } else if (msg.originalMessage != null && msg.originalMessage.chat != null) {
      return msg.originalMessage.chat.id;
    }
    return null;
  },

  /**
   * @method getChatContext
   * Get chat context from a message
   * @param {Object} msg
   * @return {ChatContext}
   */
  getChatContext: function(msg) {
    // this is deprecated
    return ChatContextStore.get(this.getChatId(msg));
  },

  /**
   * @method getMessageId
   * Get message id from a message
   * @param {Object} msg
   * @return {String}
   */
  getMessageId: function(msg) {
    if (msg.payload != null && msg.payload.messageId != null) {
      return msg.payload.messageId;
    } else if (msg.originalMessage != null && msg.originalMessage.messageId != null) {
      return msg.originalMessage.messageId;
    } else if (msg.originalMessage != null && msg.originalMessage.message_id != null) {
      return msg.originalMessage.message_id;
    }
    return null;
  },

  /**
   * @method matchContext
   * Test if topics match (intersection of arrays)
   * @param {String/Array} contexts
   * @param {String/Array} rules
   * @return {Boolean}
   */
  matchContext: function(contexts, rules) {
    contexts = contexts || [];
    rules = rules || [];
    if (rules === '*') {
      return true;
    }
    var arrayRules = _.isArray(rules) ? rules : rules.split(',');
    var arrayContexts = _.isArray(contexts) ? contexts : contexts.split(',');
    return _.intersection(arrayContexts, arrayRules).length !== 0;
  },

  /**
   * @method getTransport
   * Get the transport from a message safely
   * @param {Object} msg
   * @return {String}
   */
  getTransport: function(msg) {
    return msg != null && msg.originalMessage != null ? msg.originalMessage.transport : null;
  },

  /**
   * @method matchTransport
   * True if the node can be used with the message transport
   * @param {Object} node
   * @param {Object} msg
   * @return {Boolean}
   */
  matchTransport: function(node, msg) {
    if (_.isArray(node.transports) && !_.contains(node.transports, this.getTransport(msg))) {
      node.error('This node is not available for transport: ' + this.getTransport(msg));
      return false;
    }
    return true;
  }

};
