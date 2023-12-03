import 'zone.js/dist/zone-node';

import { APP_BASE_HREF } from '@angular/common';
// import { NgSetupOptions, RenderOptions } from '@nguniversal/express-engine';
import type { Request, Response } from 'express';
import * as express from 'express';
import * as fs from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
// import { REQUEST, RESPONSE } from '@angular/ssr';
import * as compression from 'compression';
import { CommonEngine } from '@angular/ssr';
import { StaticProvider } from '@angular/core';
import * as mongoose from 'mongoose';
import { Document, Schema } from 'mongoose';
import bootstrapServerApp from '@src/bootstrap/web/main.server';

import cors from 'cors';

export interface CacheMapDocument extends Document {
  _id: string;
  key: string;
  value: string;
  type: string;
  pageType: string;
}

export const CacheMapSchema = new Schema({
  key: { type: String, index: true },
  value: { type: String },
  type: { type: String, index: true },
  pageType: { type: String, index: true },
});

let CacheMapModel: mongoose.Model<CacheMapDocument>;
let isCacheDBConnected = false;
// console.log('before creating redis client');
// export const redisClient: RedisClientType = createClient();
// console.log('after creating redis client');

// redisClient.connect().then();
const connection = mongoose.createConnection(
  'mongodb://127.0.0.1:27017/FeCacheData?retryWrites=true',
);

CacheMapModel = connection.model<CacheMapDocument>(
  'CacheMap',
  CacheMapSchema,
  'HtmlCache',
);

connection.on('error', (e) => {
  console.log(
    'Inside MongooseCacheConfig error while creating mongodb connection',
  );
  console.error(e);
});
connection.once('open', () => {
  console.log('Inside MongooseCacheConfig MongoDB connection is created');
  isCacheDBConnected = true;
});

const getCacheMap = (): mongoose.Model<CacheMapDocument> => {
  return CacheMapModel;
};

export const setCache = (key: string, value: any): Promise<any> => {
  /*if (
    key?.indexOf('/feature/detail') > -1 ||
    key?.indexOf('/feature/list') > -1 ||
    key?.indexOf('/feature/checkout') > -1
  ) {
    return new Promise((resolve, reject) => {
      console.log('This page is not required into the cache and key is ', key);
      resolve(null);
    });
  }*/
  if (isCacheDBConnected && getCacheMap()) {
    return getCacheMap()
      .replaceOne(
        {
          key,
        },
        {
          key,
          value,
        },
        {
          upsert: true,
        },
      )
      .exec();
  } else {
    return new Promise((resolve, reject) => {
      console.log('Get Cache Map is undefined');
      resolve(null);
    });
  }
};

export const getCache = (key: string): Promise<CacheMapDocument> => {
  if (isCacheDBConnected && getCacheMap()) {
    return getCacheMap()
      .findOne({
        key,
      })
      .exec();
  } else {
    return new Promise((resolve, reject) => {
      console.log('Get Cache Map is undefined');
      resolve(null);
    });
  }
};

/*redisClient.on('error', (err) => {
  console.log('Inside Server.ts redis client connection error ', err);
});*/

/*redisClient.on('connect', () => {
  console.log('Inside Server.ts redis client is created successfully');
});*/

const allowedPaths: string[] = [
  '/feature/list',
  '/feature/detail',
  // 'user',
  '/feature/checkout',
  '/feature/bookings',
  // 'company',
  // 'coupons',
  // 'careers',
  // 'auth',
];

/**
 * This holds a cached version of each index used.
 */
const templateCache: { [key: string]: string } = {};

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();

  server.use(cors());

  server.use(
    compression({
      level: 9,
      threshold: 0,
    }),
  );

  const distFolder = join(process.cwd(), 'dist/app/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? 'index.original.html'
    : 'index';

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/main/modules/express-engine)
  server.engine(
    'html',
    ngFlavrHubExpressEngine({
      bootstrap: bootstrapServerApp,
    }),
  );

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get(
    '*.*',
    express.static(distFolder, {
      // maxAge: '1y',
    }),
  );

  server.get(
    '*.*.*',
    express.static(distFolder, {
      // maxAge: '1y',
    }),
  );

  server.get(
    '*.*.*.*',
    express.static(distFolder, {
      // maxAge: '1y',
    }),
  );

  // All regular routes use the Universal engine
  server.get('*', (req, res) => {
    res.render(indexHtml, {
      req,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl },
        // for http and cookies
        {
          provide: REQUEST,
          useValue: req,
        },
        {
          provide: RESPONSE,
          useValue: res,
        },
      ],
    });
  });

  return server;
}

function run(): void {
  const port = process.env?.PORT || 8080;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export function ngFlavrHubExpressEngine(
  setupOptions: Readonly<NgSetupOptions>,
) {
  const engine = new CommonEngine(
    setupOptions.bootstrap,
    setupOptions.providers,
  );

  return (
    filePath: string,
    options: object,
    callback: (err?: Error | null, html?: string) => void,
  ) => {
    try {
      const renderOptions = { ...options } as RenderOptions;
      if (!setupOptions.bootstrap && !renderOptions.bootstrap) {
        throw new Error('You must pass in a NgModule to be bootstrapped');
      }

      const { req } = renderOptions;
      const res = renderOptions.res ?? req.res;

      renderOptions.url =
        renderOptions.url ??
        `${req.protocol}://${req.get('host') || ''}${req.baseUrl}${req.url}`;

      console.log('Inside server.ts req?.url ', req?.url);
      console.log('Inside server.ts renderOptions.url ', renderOptions.url);

      let onlyPath: string = req?.url;
      if (onlyPath.includes('?')) {
        onlyPath = onlyPath.substring(0, onlyPath.indexOf('?'));
      }

      // console.log('final onlyPath is ', onlyPath);

      renderOptions.document = renderOptions.document || getDocument(filePath);

      // // console.log('renderOptions.document ', renderOptions.document);

      renderOptions.documentFilePath =
        renderOptions.documentFilePath ?? filePath;

      // console.log(
      //   'renderOptions.documentFilePath ',
      //   renderOptions.documentFilePath
      // );

      renderOptions.providers = [
        ...(renderOptions.providers ?? []),
        getReqResProviders(req, res),
      ];
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      renderOptions.publicPath =
        renderOptions.publicPath ??
        setupOptions.publicPath ??
        (options as any).settings?.views;

      // console.log('renderOptions.publicPath ', renderOptions.publicPath);

      renderOptions.inlineCriticalCss =
        renderOptions.inlineCriticalCss ?? setupOptions.inlineCriticalCss;

      // console.log(
      //   'renderOptions.inlineCriticalCss ',
      //   renderOptions.inlineCriticalCss
      // );

      // if (notToCachePathList?.indexOf(onlyPath) === -1) {
      // console.log('Inside server req?.query ', req?.query);
      // console.log('Inside server req?.params ', req?.params);

      /*console.log('onlyPath is ', onlyPath);
      console.log(
        `onlyPath?.indexOf('.') === -1 `,
        onlyPath?.indexOf('.') === -1,
      );
      console.log(`!Number(req?.query?.ic) `, !Number(req?.query?.ic));
      console.log(
        `allowedPaths?.includes(onlyPath) `,
        allowedPaths?.includes(onlyPath),
      );*/
      if (
        (onlyPath?.indexOf('.') === -1 && !Number(req?.query?.ic)) ||
        allowedPaths?.includes(onlyPath)
      ) {
        const userAgent = req?.headers['user-agent'];

        let deviceType: string;

        console.log('Inside server.ts user-agent ', userAgent);

        const regexp = /android|iphone|kindle|ipad/i;
        /* Using test() method to search regexp in details
        it returns boolean value*/
        if (regexp.test(userAgent)) {
          // console.log(
          //   'Inside isDesktopByUserAgent: This is not a desktop screen'
          // );
          deviceType = 'mobile';
        } else {
          // console.log('Inside isDesktopByUserAgent: This is a desktop screen');
          deviceType = 'desktop';
        }

        // console.log('device type is ', deviceType);

        let cacheKey: string = deviceType + '-b2b-html-' + onlyPath;
        console.log('final cacheKey is ', cacheKey);
        // const cached = get(cacheKey);
        getCache(cacheKey).then((cached: CacheMapDocument) => {
          if (cached?.value) {
            console.log(`Cache is available for ${cacheKey}`);
            callback(null, cached?.value);
          } else {
            console.log(`Cache is not found for ${cacheKey}`);
            engine
              .render(renderOptions)
              .then((html) => {
                if (html) {
                  if (html?.indexOf('<lib-page-not-found') > -1) {
                    console.log('Page not found ', onlyPath);
                  } else {
                    if (html?.indexOf('WEB_BROWSER_DETECTED') > -1) {
                      cacheKey = 'desktop' + '-b2b-html-' + onlyPath;
                      console.log(
                        'WEB_BROWSER_DETECTED setting html into cache for key ',
                        cacheKey,
                      );
                      setCache(cacheKey, html).then();
                    } else if (html?.indexOf('MOBILE_BROWSER_DETECTED') > -1) {
                      cacheKey = 'mobile' + '-b2b-html-' + onlyPath;
                      console.log(
                        'MOBILE_BROWSER_DETECTED setting html into cache for key ',
                        cacheKey,
                      );
                      setCache(cacheKey, html).then();
                    } else {
                      if (allowedPaths?.includes(onlyPath)) {
                        console.log(
                          'ANONYMOUS_PAGE_DETECTED Setting ==> ',
                          cacheKey,
                          onlyPath,
                        );
                        setCache(cacheKey, html).then();
                      } else {
                        console.log(
                          'Nothing detected in this case cacheKey is ',
                          cacheKey,
                          ' user agent is ',
                          userAgent,
                        );
                      }
                    }
                  }
                  // put(cacheKey, html, 7 * 1000 * 86400);
                } else {
                  console.log('html is not defined');
                }
                callback(null, html);
              })
              .catch(callback);
          }
        });
        // const cached = await redisClient.get(cacheKey);
      } else {
        engine
          .render(renderOptions)
          .then((html) => callback(null, html))
          .catch(callback);
      }
    } catch (err) {
      callback(err);
    }
  };
}

/**
 * Get providers of the request and response
 */
function getReqResProviders(req: Request, res?: Response): StaticProvider[] {
  const providers: StaticProvider[] = [
    {
      provide: REQUEST,
      useValue: req,
    },
  ];
  if (res) {
    providers.push({
      provide: RESPONSE,
      useValue: res,
    });
  }

  return providers;
}

/**
 * Get the document at the file path
 */
function getDocument(filePath: string): string {
  return (templateCache[filePath] =
    templateCache[filePath] || fs.readFileSync(filePath).toString());
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = (mainModule && mainModule.filename) || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export * from '@src/bootstrap/web/main.server';
// export * from './src/bootstrap/.server';
