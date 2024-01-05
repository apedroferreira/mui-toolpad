import express, { Router } from 'express';
import { Auth } from '@auth/core';
import GithubProvider, { GitHubEmail, GitHubProfile } from '@auth/core/providers/github';
import GoogleProvider from '@auth/core/providers/google';
import { getToken } from '@auth/core/jwt';
import { AuthConfig, TokenSet } from '@auth/core/types';
import { OAuthConfig } from '@auth/core/providers';
import { asyncHandler } from '../utils/express';
import { adaptRequestFromExpressToFetch } from './httpApiAdapters';
import { ToolpadProject } from './localMode';
import * as appDom from '../appDom';

export function createAuthHandler(project: ToolpadProject): Router {
  const { base } = project.options;

  const router = express.Router();

  const githubProvider = GithubProvider({
    clientId: process.env.TOOLPAD_GITHUB_ID,
    clientSecret: process.env.TOOLPAD_GITHUB_SECRET,
    userinfo: {
      url: 'https://api.github.com/user',
      async request({
        tokens,
        provider,
      }: {
        tokens: TokenSet;
        provider: OAuthConfig<GitHubProfile>;
      }) {
        const headers = {
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'authjs',
        };

        const profile = await fetch(provider.userinfo?.url as URL, {
          headers,
        }).then(async (githubRes) => githubRes.json());

        if (!profile.email) {
          // If the user does not have a public email, get another via the GitHub API
          // See https://docs.github.com/en/rest/users/emails#list-public-email-addresses-for-the-authenticated-user
          const githubRes = await fetch('https://api.github.com/user/emails', {
            headers,
          });

          if (githubRes.ok) {
            const emails: GitHubEmail[] = await githubRes.json();
            profile.email = (emails.find((e) => e.primary) ?? emails[0]).email;
            profile.verifiedEmails = emails.filter((e) => e.verified).map((e) => e.email);
          }
        }

        return profile;
      },
    },
  });

  const googleProvider = GoogleProvider({
    clientId: process.env.TOOLPAD_GOOGLE_CLIENT_ID,
    clientSecret: process.env.TOOLPAD_GOOGLE_CLIENT_SECRET,
    authorization: {
      params: {
        prompt: 'consent',
        access_type: 'offline',
        response_type: 'code',
      },
    },
  });

  const authConfig: AuthConfig = {
    pages: {
      signIn: `${base}/signin`,
      signOut: base,
      error: `${base}/signin`, // Error code passed in query string as ?error=
      verifyRequest: base,
    },
    providers: [githubProvider, googleProvider],
    secret: process.env.TOOLPAD_AUTH_SECRET,
    trustHost: true,
    callbacks: {
      async signIn({ account, profile }) {
        const dom = await project.loadDom();
        const app = appDom.getApp(dom);

        const restrictedDomains = app.attributes.authentication?.restrictedDomains ?? [];

        if (account?.provider === 'github') {
          return Boolean(
            profile?.verifiedEmails &&
              profile.verifiedEmails.length > 0 &&
              (restrictedDomains.length === 0 ||
                restrictedDomains.some((restrictedDomain) =>
                  profile.verifiedEmails!.some((verifiedEmail) =>
                    verifiedEmail.endsWith(`@${restrictedDomain}`),
                  ),
                )),
          );
        }

        if (account?.provider === 'google') {
          return Boolean(
            profile?.email_verified &&
              profile?.email &&
              (restrictedDomains.length === 0 ||
                restrictedDomains.some(
                  (restrictedDomain) => profile.email!.endsWith(`@${restrictedDomain}`) ?? false,
                )),
          );
        }

        return true;
      },
      async redirect({ baseUrl }) {
        return `${baseUrl}${base}`;
      },
    },
  };

  router.use(
    '/*',
    asyncHandler(async (req, res) => {
      const request = adaptRequestFromExpressToFetch(req);

      const response = (await Auth(request, authConfig)) as Response;

      // Converting Fetch API's Response to Express' res
      res.status(response.status);
      res.contentType(response.headers.get('content-type') ?? 'text/plain');
      response.headers.forEach((value, key) => {
        if (value) {
          res.setHeader(key, value);
        }
      });
      const body = await response.text();
      res.send(body);
    }),
  );

  return router;
}

export async function createAuthPagesMiddleware(project: ToolpadProject) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { options } = project;
    const { base } = options;

    const dom = await project.loadDom();

    const app = appDom.getApp(dom);

    const authProviders = app.attributes.authentication?.providers ?? [];

    const hasAuthentication = authProviders.length > 0;

    const signInPath = `${base}/signin`;

    let isRedirect = false;
    if (
      hasAuthentication &&
      req.get('sec-fetch-dest') === 'document' &&
      req.originalUrl.split('?')[0] !== signInPath &&
      !req.originalUrl.startsWith(`${base}/api/auth`)
    ) {
      const request = adaptRequestFromExpressToFetch(req);

      let token;
      if (process.env.TOOLPAD_AUTH_SECRET) {
        // @TODO: Library types are wrong as salt should not be required, remove once fixed
        // Github discussion: https://github.com/nextauthjs/next-auth/discussions/9133
        // @ts-ignore
        token = await getToken({
          req: request,
          secret: process.env.TOOLPAD_AUTH_SECRET,
        });
      }

      if (!token) {
        isRedirect = true;
      }
    }

    if (isRedirect) {
      res.redirect(signInPath);
      res.end();
    } else {
      next();
    }
  };
}