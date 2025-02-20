import SERVICES from './services';
import './index.css';
import {debounce} from 'debounce';

/**
 * @typedef {Object} EmbedData
 * @description Embed Tool data
 * @property {string} service - service name
 * @property {string} url - source URL of embedded content
 * @property {string} embed - URL to source embed page
 * @property {number} [width] - embedded content width
 * @property {number} [height] - embedded content height
 * @property {string} [caption] - content caption
 *
 * @typedef {Object} Service
 * @description Service configuration object
 * @property {RegExp} regex - pattern of source URLs
 * @property {string} embedUrl - URL scheme to embedded page. Use '<%= remote_id %>' to define a place to insert resource id
 * @property {string} html - iframe which contains embedded content
 * @property {number} [height] - iframe height
 * @property {number} [width] - iframe width
 * @property {Function} [id] - function to get resource id from RegExp groups
 *
 * @typedef {Object} EmbedConfig
 * @description Embed tool configuration object
 * @property {Object} [services] - additional services provided by user. Each property should contain Service object
 */

/**
 * @class Embed
 * @classdesc Embed Tool for Editor.js 2.0
 *
 * @property {Object} api - Editor.js API
 * @property {EmbedData} _data - private property with Embed data
 * @property {HTMLElement} element - embedded content container
 *
 * @property {Object} services - static property with available services
 * @property {Object} patterns - static property with patterns for paste handling configuration
 */
export default class Embed {
  /**
   * @param {{data: EmbedData, config: EmbedConfig, api: object}}
   *   data — previously saved data
   *   config - user config for Tool
   *   api - Editor.js API
   */
  constructor({data, api}) {

    this.api = api;
    this._data = {};
    this.element = null;

    this.data = data;

    this.nodes = {
      wrapper: null,
      container: null,
      progress: null,
      input: null,
        img: null,
      inputHolder: null,
      linkContent: null,
      linkImage: null,
      linkTitle: null,
      linkDescription: null,
      linkText: null
    };
  }

  /**
   * @param {EmbedData} data
   * @param {RegExp} [data.regex] - pattern of source URLs
   * @param {string} [data.embedUrl] - URL scheme to embedded page. Use '<%= remote_id %>' to define a place to insert resource id
   * @param {string} [data.html] - iframe which contains embedded content
   * @param {number} [data.height] - iframe height
   * @param {number} [data.width] - iframe width
   * @param {string} [data.caption] - caption
   */
  set data(data) {
    if (!(data instanceof Object)) {
      throw Error('Embed Tool data should be object');
    }

    const {service, source, embed, width, height, caption = ''} = data;

    this._data = {
      service: service || this.data.service,
      source: source || this.data.source,
      embed: embed || this.data.embed,
      width: width || this.data.width,
      height: height || this.data.height,
      caption: caption || this.data.caption || '',
    };

    const oldView = this.element;
    if (oldView) {
      oldView.parentNode.replaceChild(this.render(), oldView);
    }
  }

  /**
   * @return {EmbedData}
   */
  get data() {
    if (this.element) {
      const caption = this.element.querySelector(`.${this.api.styles.input}`);

      this._data.caption = caption ? caption.innerHTML : '';
    }

    return this._data;
  }

  /**
   * Get plugin styles
   * @return {Object}
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      inputEl: 'link-tool__input',
      inputHolder: 'embed-tool__input-holder',
      inputError: 'embed-tool__input-holder--error',
      progress: 'embed-tool__progress',
      progressLoading: 'embed-tool__progress--loading',
      progressLoaded: 'embed-tool__progress--loaded',
      input: this.api.styles.input,
      container: 'embed-tool',
      containerLoading: 'embed-tool--loading',
      preloader: 'embed-tool__preloader',
      caption: 'embed-tool__caption',
      url: 'embed-tool__url',
      content: 'embed-tool__content'
    };
  }

  /**
   * Render Embed tool content
   *
   * @return {HTMLElement}
   */
  render() {

    if (!this.data.service) {
      const container = document.createElement('div');
        this.nodes.img = this.make('div', 'input-img');
        this.nodes.img.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M4 20V4H20V20H4ZM5 5H19V19H5V5ZM8.59326 9.32916H14.21L8.603 14.9362L9.3101 15.6433L14.9067 10.0467V15.5327H15.9067V8.32916H8.59326V9.32916Z" fill="#212132"/>
</svg>`;
      this.nodes.inputHolder = this.makeInputHolder();
        this.nodes.inputHolder.prepend(this.nodes.img);


      container.appendChild(this.nodes.inputHolder);
        // const input = this.make('input',  ['embed-tool__input']);
        // container.appendChild(input);


        this.element = container;

      return container;
    }


    const {html} = Embed.services[this.data.service];
    const container = document.createElement('div');
    const caption = document.createElement('div');
    const template = document.createElement('template');
    const preloader = this.createPreloader();

    container.classList.add(this.CSS.baseClass, this.CSS.container, this.CSS.containerLoading);
    caption.classList.add(this.CSS.caption);

    container.appendChild(preloader);

    caption.contentEditable = true;

    template.innerHTML = html;
    template.content.firstChild.setAttribute('src', this.data.embed);
    template.content.firstChild.classList.add(this.CSS.content);

    const embedIsReady = this.embedIsReady(container);

    container.appendChild(template.content.firstChild);
    container.appendChild(caption);

    embedIsReady
      .then(() => {
        container.classList.remove(this.CSS.containerLoading);
      });

    this.element = container;

    return container;
  }

      /**
   * Get Tool toolbox settings
   * icon - Tool icon's SVG
   * title - title to show in toolbox
   *
   * @return {{icon: string, title: string}}
   */
  static get toolbox() {
    return {
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M6 4C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6ZM18 5H6C5.44772 5 5 5.44772 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V6C19 5.44772 18.5523 5 18 5ZM9.04134 7.65814L16.4752 11.8482L9.04134 16.3761V7.65814ZM10.0413 9.36968V14.5961L14.498 11.8816L10.0413 9.36968Z" fill="#212132"/>
      </svg>`,
      title: 'Embed'
    };
  }

  /**
   * Creates preloader to append to container while data is loading
   * @return {HTMLElement} preloader
   */
  createPreloader() {
    const preloader = document.createElement('preloader');
    // const url = document.createElement('div');

    // url.textContent = this.data.source;

    // preloader.classList.add(this.CSS.preloader);
    // url.classList.add(this.CSS.url);

    // preloader.appendChild(url);

    return preloader;
  }

  /**
   * Save current content and return EmbedData object
   *
   * @return {EmbedData}
   */
  save() {
    return this.data;
  }

  /**
   * Handle pasted url and return Service object
   *
   * @param {PasteEvent} event- event with pasted data
   * @return {Service}
   */
  onPaste(event) {
    this.performServices(event);
  }

  performServices(event) {
    const {key: service, data: url} = event.detail;

    const {regex, embedUrl, width, height, id = (ids) => ids.shift()} = Embed.services[service];
    const result = regex.exec(url).slice(1);
    const embed = embedUrl.replace(/<\%\= remote\_id \%\>/g, id(result));

    this.data = {
      service,
      source: url,
      embed,
      width,
      height
    };
  }

  /**
   * Analyze provided config and make object with services to use
   *
   * @param {EmbedConfig} config
   */
  static prepare({config = {}}) {
    let {services = {}} = config;
    let entries = Object.entries(SERVICES);

    const enabledServices = Object
      .entries(services)
      .filter(([key, value]) => {
        return typeof value === 'boolean' && value === true;
      })
      .map(([ key ]) => key);

    const userServices = Object
      .entries(services)
      .filter(([key, value]) => {
        return typeof value === 'object';
      })
      .filter(([key, service]) => Embed.checkServiceConfig(service))
      .map(([key, service]) => {
        const {regex, embedUrl, html, height, width, id} = service;

        return [key, {
          regex,
          embedUrl,
          html,
          height,
          width,
          id
        } ];
      });

    if (enabledServices.length) {
      entries = entries.filter(([ key ]) => enabledServices.includes(key));
    }

    entries = entries.concat(userServices);

    Embed.services = entries.reduce((result, [key, service]) => {
      if (!(key in result)) {
        result[key] = service;
        return result;
      }

      result[key] = Object.assign({}, result[key], service);
      return result;
    }, {});

    Embed.patterns = entries
      .reduce((result, [key, item]) => {
        result[key] = item.regex;

        return result;
      }, {});
  }

  /**
   * Check if Service config is valid
   *
   * @param {Service} config
   * @return {boolean}
   */
  static checkServiceConfig(config) {
    const {regex, embedUrl, html, height, width, id} = config;

    let isValid = regex && regex instanceof RegExp
      && embedUrl && typeof embedUrl === 'string'
      && html && typeof html === 'string';

    isValid = isValid && (id !== undefined ? id instanceof Function : true);
    isValid = isValid && (height !== undefined ? Number.isFinite(height) : true);
    isValid = isValid && (width !== undefined ? Number.isFinite(width) : true);

    return isValid;
  }

  /**
   * Paste configuration to enable pasted URLs processing by Editor
   */
  static get pasteConfig() {
    return {
      patterns: Embed.patterns
    };
  }

  /**
   * Checks that mutations in DOM have finished after appending iframe content
   * @param {HTMLElement} targetNode - HTML-element mutations of which to listen
   * @return {Promise<any>} - result that all mutations have finished
   */
  embedIsReady(targetNode) {
    const PRELOADER_DELAY = 450;

    let observer = null;

    return new Promise((resolve, reject) => {
      observer = new MutationObserver(debounce(resolve, PRELOADER_DELAY));
      observer.observe(targetNode, {childList: true, subtree: true});
    }).then(() => {
      observer.disconnect();
    });
  }

  startLoading(data) {
    this.performServices(data);
  }

  matchService(url) {
    if (url.match('youtube')) {
      return this.composePasteEventMock('youtube', url);
    }
    if (url.match('codepen')) {
      return this.composePasteEventMock('codepen', url);
    }
    if (url.match('vimeo')) {
      return this.composePasteEventMock('vimeo', url);
    }
    return null;
  }

  makeInputHolder() {
    const inputHolder = this.make('div', this.CSS.inputHolder);

    this.nodes.progress = this.make('label', this.CSS.progress);
    this.nodes.input = this.make('div', [this.CSS.input, this.CSS.inputEl], {
      contentEditable: true
    });

    this.nodes.input.dataset.placeholder = 'Link';

    this.nodes.input.addEventListener('paste', (event) => {
      let url;
      if (event.type === 'paste') {
        url = (event.clipboardData || window.clipboardData).getData('text');
      }

      this.startLoading(this.matchService(url));
    });

    this.nodes.input.addEventListener('keydown', (event) => {
      const [ENTER, A] = [13, 65];
      const cmdPressed = event.ctrlKey || event.metaKey;
      switch (event.keyCode) {
        case ENTER:
          event.preventDefault();
          event.stopPropagation();

          this.startLoading(this.matchService(this.nodes.input.textContent));
          break;
        case A:
          break;
      }
    });

    inputHolder.appendChild(this.nodes.progress);
    inputHolder.appendChild(this.nodes.input);

    return inputHolder;
  }

  make(tagName, classNames = null, attributes = {}) {
    const el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (const attrName in attributes) {
      el[attrName] = attributes[attrName];
    }

    return el;
  }

  composePasteEventMock(service, url) {
    return {
      detail: {
        key: service,
        data: url
      }
    }
  };
}
