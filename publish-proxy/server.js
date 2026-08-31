/* =========================================================
   LA TERMITIÈRE — PUBLISH PROXY
   =========================================================

   Responsabilités :

   1. Authentifier le personnel autorisé
   2. Publier les offres d'emploi
   3. Publier les promotions
   4. Stocker le contenu dans le volume Docker partagé
   5. Exposer les contenus publics au site vitrine
   6. Servir les images publiées

   Architecture :

      Personnel
          │
          ▼
      publish-proxy
          │
          ▼
      /content
          │
          ├── data/offres.json
          ├── data/promotions.json
          └── images/uploads/*
                  │
                  ▼
          volume Docker
          termitiere-content

   IMPORTANT :

   GitHub / GitHub Actions ne sont PAS utilisés
   pour les publications de contenu.

   GitHub reste réservé au code et au CI/CD.

   Variables obligatoires :

     SESSION_SECRET
     USERS_JSON

   Variables optionnelles :

     PORT=8082
     COOKIE_SECURE=true
     ALLOWED_ORIGIN=https://latermitiere.com
     CONTENT_CACHE_SECONDS=10
     CONTENT_DIR=/content

   ========================================================= */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');


/* =========================================================
   CONFIGURATION
   ========================================================= */

const {
  SESSION_SECRET,
  USERS_JSON,

  PORT = 8082,

  COOKIE_SECURE = 'true',

  ALLOWED_ORIGIN = 'https://latermitiere.com',

  CONTENT_CACHE_SECONDS = '10',

  CONTENT_DIR = '/content',
} = process.env;


if (
  !SESSION_SECRET ||
  !USERS_JSON
) {
  console.error(
    'SESSION_SECRET et USERS_JSON sont obligatoires.'
  );

  process.exit(1);
}


/* =========================================================
   CHEMINS CONTENU
   ========================================================= */

const DATA_DIRECTORY =
  path.join(
    CONTENT_DIR,
    'data'
  );

const UPLOADS_DIRECTORY =
  path.join(
    CONTENT_DIR,
    'images',
    'uploads'
  );

const OFFRES_PATH =
  path.join(
    DATA_DIRECTORY,
    'offres.json'
  );

const PROMOTIONS_PATH =
  path.join(
    DATA_DIRECTORY,
    'promotions.json'
  );


/* =========================================================
   INITIALISATION DU STOCKAGE
   ========================================================= */

function ensureStorage() {
  fs.mkdirSync(
    DATA_DIRECTORY,
    {
      recursive: true,
    }
  );

  fs.mkdirSync(
    UPLOADS_DIRECTORY,
    {
      recursive: true,
    }
  );


  if (
    !fs.existsSync(
      OFFRES_PATH
    )
  ) {
    fs.writeFileSync(
      OFFRES_PATH,
      JSON.stringify(
        {
          items: [],
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  }


  if (
    !fs.existsSync(
      PROMOTIONS_PATH
    )
  ) {
    fs.writeFileSync(
      PROMOTIONS_PATH,
      JSON.stringify(
        {
          items: [],
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  }
}


try {
  ensureStorage();
} catch (err) {
  console.error(
    'Impossible d initialiser le stockage contenu :',
    err
  );

  process.exit(1);
}


/* =========================================================
   UTILISATEURS
   ========================================================= */

let USERS;

try {
  USERS = JSON.parse(
    USERS_JSON
  );

  if (
    !Array.isArray(USERS)
  ) {
    throw new Error(
      'USERS_JSON doit être un tableau.'
    );
  }

  USERS.forEach(
    (user) => {
      if (
        !user.email ||
        !user.passwordHash
      ) {
        throw new Error(
          'Chaque utilisateur doit contenir email et passwordHash.'
        );
      }
    }
  );

} catch (err) {
  console.error(
    'USERS_JSON invalide :',
    err.message
  );

  process.exit(1);
}


/* =========================================================
   EXPRESS
   ========================================================= */

const app =
  express();

app.set(
  'trust proxy',
  true
);

app.use(
  express.json({
    limit: '1mb',
  })
);


/* =========================================================
   SESSION
   ========================================================= */

app.use(
  session({
    secret:
      SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    cookie: {
      httpOnly:
        true,

      sameSite:
        'lax',

      secure:
        COOKIE_SECURE !== 'false',

      maxAge:
        8 * 60 * 60 * 1000,
    },
  })
);


/* =========================================================
   CORS
   ========================================================= */

app.use(
  (req, res, next) => {
    const origin =
      req.headers.origin;

    if (
      origin ===
        ALLOWED_ORIGIN ||
      origin ===
        'https://www.latermitiere.com'
    ) {
      res.setHeader(
        'Access-Control-Allow-Origin',
        origin
      );

      res.setHeader(
        'Access-Control-Allow-Credentials',
        'true'
      );
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS'
    );

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type'
    );

    if (
      req.method ===
      'OPTIONS'
    ) {
      return res.sendStatus(
        204
      );
    }

    next();
  }
);


/* =========================================================
   UPLOAD IMAGE
   ========================================================= */

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        5 * 1024 * 1024,
    },

    fileFilter:
      (req, file, cb) => {
        if (
          !/^image\//i.test(
            file.mimetype
          )
        ) {
          return cb(
            new Error(
              'Seules les images sont autorisées.'
            )
          );
        }

        cb(
          null,
          true
        );
      },
  });


/* =========================================================
   SECTEURS
   ========================================================= */

const SECTORS = [
  {
    value:
      'sport',

    label:
      'Maxi Gym',
  },

  {
    value:
      'briqueterie',

    label:
      'La Briqueterie',
  },

  {
    value:
      'garderie',

    label:
      'La Garderie',
  },

  {
    value:
      'agro',

    label:
      'Maxi Agro',
  },

  {
    value:
      'batiment',

    label:
      'Maxi Bâtiment',
  },

  {
    value:
      'logistique',

    label:
      'Maxi Logistique',
  },

  {
    value:
      'efoncier',

    label:
      'La Foncière',
  },

  {
    value:
      'cosmetique',

    label:
      'Maxi Cosmétique',
  },
];


/* =========================================================
   LECTURE JSON
   ========================================================= */

function readJsonFile(
  filePath
) {
  if (
    !fs.existsSync(
      filePath
    )
  ) {
    return {
      items: [],
    };
  }

  const content =
    fs.readFileSync(
      filePath,
      'utf8'
    );

  let data;

  try {
    data =
      JSON.parse(
        content
      );
  } catch (err) {
    throw new Error(
      `JSON invalide dans ${filePath}.`
    );
  }

  if (
    !data ||
    !Array.isArray(
      data.items
    )
  ) {
    throw new Error(
      `"items" doit être un tableau dans ${filePath}.`
    );
  }

  return data;
}


/* =========================================================
   ÉCRITURE JSON ATOMIQUE
   ========================================================= */

function writeJsonFile(
  filePath,
  data
) {
  const content =
    JSON.stringify(
      data,
      null,
      2
    ) + '\n';

  const temporaryPath =
    `${filePath}.${process.pid}.${Date.now()}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    content,
    'utf8'
  );

  fs.renameSync(
    temporaryPath,
    filePath
  );
}


/* =========================================================
   CACHE CONTENU PUBLIC
   ========================================================= */

const cache = {
  offres:
    null,

  promotions:
    null,
};


function cacheDurationMs() {
  const seconds =
    Number(
      CONTENT_CACHE_SECONDS
    );

  if (
    !Number.isFinite(
      seconds
    ) ||
    seconds < 0
  ) {
    return 10000;
  }

  return seconds * 1000;
}


function getCachedContent(
  type,
  filePath
) {
  const now =
    Date.now();

  const cached =
    cache[type];

  if (
    cached &&
    now -
      cached.timestamp <
      cacheDurationMs()
  ) {
    return cached.data;
  }

  const data =
    readJsonFile(
      filePath
    );

  cache[type] = {
    timestamp:
      now,

    data,
  };

  return data;
}


function invalidateCache(
  type
) {
  cache[type] =
    null;
}


/* =========================================================
   UTILITAIRES
   ========================================================= */

const DIACRITICS_RE =
  new RegExp(
    '[' +
      String.fromCharCode(
        0x300
      ) +
      '-' +
      String.fromCharCode(
        0x36f
      ) +
      ']',
    'g'
  );


function slugify(
  value
) {
  return String(
    value
  )
    .normalize(
      'NFD'
    )
    .replace(
      DIACRITICS_RE,
      ''
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /(^-|-$)/g,
      ''
    )
    .slice(
      0,
      60
    ) ||
    'photo';
}


function cleanItem(
  item
) {
  Object.keys(
    item
  ).forEach(
    (key) => {
      if (
        item[key] ===
          undefined ||
        item[key] ===
          null ||
        item[key] ===
          ''
      ) {
        delete item[key];
      }
    }
  );

  return item;
}


function requireAuth(
  req,
  res,
  next
) {
  if (
    !req.session.email
  ) {
    return res
      .status(401)
      .json({
        ok:
          false,

        error:
          'Non connecté.',
      });
  }

  next();
}


/* =========================================================
   NOM FICHIER IMAGE
   ========================================================= */

function buildImageFilename(
  originalName
) {
  const parsed =
    path.parse(
      originalName ||
        ''
    );

  let extension =
    parsed.ext.toLowerCase();

  const allowedExtensions =
    [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.gif',
    ];

  if (
    !allowedExtensions.includes(
      extension
    )
  ) {
    extension =
      '.jpg';
  }

  const baseName =
    slugify(
      parsed.name ||
        'photo'
    );

  const unique =
    `${Date.now()}-${crypto
      .randomBytes(5)
      .toString('hex')}`;

  return (
    `${unique}-${baseName}${extension}`
  );
}


/* =========================================================
   SAUVEGARDE IMAGE
   ========================================================= */

function saveUploadedImage(
  file
) {
  const filename =
    buildImageFilename(
      file.originalname
    );

  const destination =
    path.join(
      UPLOADS_DIRECTORY,
      filename
    );

  fs.writeFileSync(
    destination,
    file.buffer
  );

  return {
    filename,

    url:
      `/images/uploads/${filename}`,
  };
}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  '/health',
  (req, res) => {
    res.json({
      ok:
        true,

      service:
        'publish-proxy',

      storage:
        CONTENT_DIR,
    });
  }
);


/* =========================================================
   SESSION
   ========================================================= */

app.get(
  '/api/session',
  (req, res) => {
    res.json({
      ok:
        true,

      email:
        req.session.email ||
        null,

      sectors:
        SECTORS,
    });
  }
);


/* =========================================================
   LOGIN
   ========================================================= */

app.post(
  '/api/login',

  async (
    req,
    res
  ) => {
    const {
      email,
      password,
    } =
      req.body || {};

    const normalizedEmail =
      String(
        email || ''
      )
        .trim()
        .toLowerCase();

    const user =
      USERS.find(
        (u) =>
          String(
            u.email || ''
          )
            .trim()
            .toLowerCase() ===
          normalizedEmail
      );

    let valid =
      false;

    if (
      user
    ) {
      valid =
        await bcrypt.compare(
          String(
            password || ''
          ),
          user.passwordHash
        );
    }

    if (
      !valid
    ) {
      return res
        .status(401)
        .json({
          ok:
            false,

          error:
            'Email ou mot de passe incorrect.',
        });
    }

    req.session.email =
      user.email;

    res.json({
      ok:
        true,

      email:
        user.email,
    });
  }
);


/* =========================================================
   LOGOUT
   ========================================================= */

app.post(
  '/api/logout',

  (req, res) => {
    req.session.destroy(
      (err) => {
        if (
          err
        ) {
          console.error(
            'Erreur destruction session:',
            err
          );

          return res
            .status(500)
            .json({
              ok:
                false,

              error:
                'Impossible de fermer la session.',
            });
        }

        res.json({
          ok:
            true,
        });
      }
    );
  }
);


/* =========================================================
   API PUBLIQUE — OFFRES
   ========================================================= */

app.get(
  '/api/content/offres',

  (req, res) => {
    try {
      const data =
        getCachedContent(
          'offres',
          OFFRES_PATH
        );

      res.setHeader(
        'Cache-Control',
        'public, max-age=10'
      );

      res.json(
        data
      );

    } catch (
      err
    ) {
      console.error(
        'Erreur lecture offres:',
        err
      );

      res
        .status(503)
        .json({
          ok:
            false,

          error:
            'Contenu temporairement indisponible.',
        });
    }
  }
);


/* =========================================================
   API PUBLIQUE — PROMOTIONS
   ========================================================= */

app.get(
  '/api/content/promotions',

  (req, res) => {
    try {
      const data =
        getCachedContent(
          'promotions',
          PROMOTIONS_PATH
        );

      res.setHeader(
        'Cache-Control',
        'public, max-age=10'
      );

      res.json(
        data
      );

    } catch (
      err
    ) {
      console.error(
        'Erreur lecture promotions:',
        err
      );

      res
        .status(503)
        .json({
          ok:
            false,

          error:
            'Contenu temporairement indisponible.',
        });
    }
  }
);


/* =========================================================
   PUBLICATION OFFRE
   ========================================================= */

app.post(
  '/api/offres',

  requireAuth,

  upload.single(
    'photo'
  ),

  (req, res) => {
    const {
      title,
      type,
      location,
      sector,
      description,
      dateLimite,
    } =
      req.body || {};

    if (
      !title ||
      !type
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            'Titre et type de contrat obligatoires.',
        });
    }

    let savedImage =
      null;

    try {

      /* -----------------------------------------------------
         IMAGE
         ----------------------------------------------------- */

      if (
        req.file
      ) {
        savedImage =
          saveUploadedImage(
            req.file
          );
      }


      /* -----------------------------------------------------
         JSON
         ----------------------------------------------------- */

      const data =
        readJsonFile(
          OFFRES_PATH
        );

      const item =
        cleanItem({
          title:
            String(
              title
            ).trim(),

          type:
            String(
              type
            ).trim(),

          location:
            String(
              location ||
                ''
            ).trim(),

          sector:
            String(
              sector ||
                ''
            ).trim(),

          description:
            String(
              description ||
                ''
            ).trim(),

          dateLimite:
            String(
              dateLimite ||
                ''
            ).trim(),

          photo:
            savedImage
              ? savedImage.url
              : null,
        });


      data.items.unshift(
        item
      );


      writeJsonFile(
        OFFRES_PATH,
        data
      );


      invalidateCache(
        'offres'
      );


      console.log(
        `Offre publiée : "${title}" ` +
        `via ${req.session.email}`
      );


      res.json({
        ok:
          true,

        item,
      });

    } catch (
      err
    ) {
      console.error(
        'Erreur publication offre:',
        err
      );

      /*
       * Si l'écriture du JSON échoue après
       * l'upload de l'image, on supprime
       * l'image afin d'éviter un fichier orphelin.
       */

      if (
        savedImage
      ) {
        try {
          fs.unlinkSync(
            path.join(
              UPLOADS_DIRECTORY,
              savedImage.filename
            )
          );
        } catch (
          cleanupError
        ) {
          console.error(
            'Erreur nettoyage image:',
            cleanupError
          );
        }
      }

      res
        .status(500)
        .json({
          ok:
            false,

          error:
            'Échec de la publication.',
        });
    }
  }
);


/* =========================================================
   PUBLICATION PROMOTION
   ========================================================= */

app.post(
  '/api/promotions',

  requireAuth,

  upload.single(
    'photo'
  ),

  (req, res) => {
    const {
      title,
      sector,
      description,
      validUntil,
    } =
      req.body || {};

    if (
      !title
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            'Titre obligatoire.',
        });
    }

    let savedImage =
      null;

    try {

      /* -----------------------------------------------------
         IMAGE
         ----------------------------------------------------- */

      if (
        req.file
      ) {
        savedImage =
          saveUploadedImage(
            req.file
          );
      }


      /* -----------------------------------------------------
         JSON
         ----------------------------------------------------- */

      const data =
        readJsonFile(
          PROMOTIONS_PATH
        );

      const item =
        cleanItem({
          title:
            String(
              title
            ).trim(),

          sector:
            String(
              sector ||
                ''
            ).trim(),

          description:
            String(
              description ||
                ''
            ).trim(),

          validUntil:
            String(
              validUntil ||
                ''
            ).trim(),

          photo:
            savedImage
              ? savedImage.url
              : null,
        });


      data.items.unshift(
        item
      );


      writeJsonFile(
        PROMOTIONS_PATH,
        data
      );


      invalidateCache(
        'promotions'
      );


      console.log(
        `Promotion publiée : "${title}" ` +
        `via ${req.session.email}`
      );


      res.json({
        ok:
          true,

        item,
      });

    } catch (
      err
    ) {
      console.error(
        'Erreur publication promotion:',
        err
      );


      /*
       * Nettoyage de l'image si
       * l'écriture du JSON échoue.
       */

      if (
        savedImage
      ) {
        try {
          fs.unlinkSync(
            path.join(
              UPLOADS_DIRECTORY,
              savedImage.filename
            )
          );
        } catch (
          cleanupError
        ) {
          console.error(
            'Erreur nettoyage image:',
            cleanupError
          );
        }
      }


      res
        .status(500)
        .json({
          ok:
            false,

          error:
            'Échec de la publication.',
        });
    }
  }
);


/* =========================================================
   IMAGES PUBLIQUES
   ========================================================= */

app.get(
  '/api/content/images/:filename',

  (req, res) => {
    try {
      const filename =
        path.basename(
          req.params.filename
        );

      if (
        filename !==
        req.params.filename
      ) {
        return res
          .status(400)
          .send(
            'Nom de fichier invalide.'
          );
      }


      const imagePath =
        path.join(
          UPLOADS_DIRECTORY,
          filename
        );


      if (
        !fs.existsSync(
          imagePath
        )
      ) {
        return res
          .status(404)
          .send(
            'Image introuvable.'
          );
      }


      const extension =
        path
          .extname(
            filename
          )
          .toLowerCase();


      const mimeTypes = {
        '.jpg':
          'image/jpeg',

        '.jpeg':
          'image/jpeg',

        '.png':
          'image/png',

        '.webp':
          'image/webp',

        '.gif':
          'image/gif',
      };


      const contentType =
        mimeTypes[
          extension
        ] ||
        'application/octet-stream';


      res.setHeader(
        'Content-Type',
        contentType
      );

      res.setHeader(
        'Cache-Control',
        'public, max-age=3600'
      );


      res.sendFile(
        imagePath
      );

    } catch (
      err
    ) {
      console.error(
        'Erreur lecture image:',
        err
      );

      res
        .status(503)
        .send(
          'Image temporairement indisponible.'
        );
    }
  }
);


/* =========================================================
   GESTION DES ERREURS MULTER
   ========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    if (
      err &&
      err.name ===
        'MulterError'
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            err.code ===
            'LIMIT_FILE_SIZE'
              ? 'Image trop volumineuse. Taille maximale : 5 Mo.'
              : 'Erreur lors de l’upload de l’image.',
        });
    }


    if (
      err &&
      err.message ===
        'Seules les images sont autorisées.'
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            err.message,
        });
    }


    console.error(
      'Erreur serveur non gérée:',
      err
    );


    res
      .status(500)
      .json({
        ok:
          false,

        error:
          'Erreur serveur.',
      });
  }
);


/* =========================================================
   DÉMARRAGE
   ========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      '=========================================='
    );

    console.log(
      'LA TERMITIÈRE — PUBLISH PROXY'
    );

    console.log(
      '=========================================='
    );

    console.log(
      `Port : ${PORT}`
    );

    console.log(
      `Stockage contenu : ${CONTENT_DIR}`
    );

    console.log(
      `Données : ${DATA_DIRECTORY}`
    );

    console.log(
      `Uploads : ${UPLOADS_DIRECTORY}`
    );

    console.log(
      `Origin autorisée : ${ALLOWED_ORIGIN}`
    );

    console.log(
      `Cache contenu : ${CONTENT_CACHE_SECONDS}s`
    );

    console.log(
      'Stockage : volume Docker termitiere-content'
    );

    console.log(
      'GitHub : utilisé uniquement pour le code / CI-CD'
    );

    console.log(
      '=========================================='
    );
  }
);
