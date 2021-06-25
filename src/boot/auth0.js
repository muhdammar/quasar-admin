import { boot } from "quasar/wrappers";
import createAuth0Client from "@auth0/auth0-spa-js";
import { computed, reactive, watchEffect } from "vue";
import options from "../../auth_config.json";
let client;
const state = reactive({
  loading: true,
  isAuthenticated: false,
  user: {},
  popupOpen: false,
  error: null,
});

async function loginWithPopup() {
  state.popupOpen = true;

  try {
    await client.loginWithPopup(0);
  } catch (e) {
    console.error(e);
  } finally {
    state.popupOpen = false;
  }

  state.user = await client.getUser();
  state.isAuthenticated = true;
}

async function handleRedirectCallback() {
  state.loading = true;

  try {
    await client.handleRedirectCallback();
    state.user = await client.getUser();
    state.isAuthenticated = true;
  } catch (e) {
    state.error = e;
  } finally {
    state.loading = false;
  }
}

function loginWithRedirect(o) {
  return client.loginWithRedirect(o);
}

function getIdTokenClaims(o) {
  return client.getIdTokenClaims(o);
}

function getTokenSilently(o) {
  return client.getTokenSilently(o);
}

function getTokenWithPopup(o) {
  return client.getTokenWithPopup(o);
}

function logout(o) {
  return client.logout(o);
}

const authPlugin = {
  isAuthenticated: computed(() => state.isAuthenticated),
  loading: computed(() => state.loading),
  user: computed(() => state.user),
  getIdTokenClaims,
  getTokenSilently,
  getTokenWithPopup,
  handleRedirectCallback,
  loginWithRedirect,
  loginWithPopup,
  logout,
};

export const routeGuard = (to, from, next) => {
  const { isAuthenticated, loading, loginWithRedirect } = authPlugin;

  const verify = () => {
    // If the user is authenticated, continue with the route
    if (isAuthenticated.value) {
      return next();
    }

    // Otherwise, log in
    loginWithRedirect({ appState: { targetUrl: to.fullPath } });
  };

  // If loading has already finished, check our auth state using `fn()`
  if (!loading.value) {
    return verify();
  }

  // Watch for the loading property to change before we check isAuthenticated
  watchEffect(() => {
    if (loading.value === false) {
      return verify();
    }
  });
};

import router from "../router/index.js";

function callbackRedirect(appState) {
  history.replaceState({}, document.title, window.location.pathname);
  router.push(appState && appState.targetUrl ? appState.targetUrl : "/");
}

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async ({ app, router }) => {
  client = await createAuth0Client({
    ...options,
  });

  try {
    // If the user is returning to the app after authentication

    if (
      window.location.search.includes("code=") &&
      window.location.search.includes("state=")
    ) {
      // handle the redirect and retrieve tokens
      const { appState } = await client.handleRedirectCallback();

      // Notify subscribers that the redirect callback has happened, passing the appState
      // (useful for retrieving any pre-authentication state)
      callbackRedirect(appState);
    }
  } catch (e) {
    state.error = e;
  } finally {
    // Initialize our internal authentication state
    state.isAuthenticated = await client.isAuthenticated();
    state.user = await client.getUser();
    state.loading = false;
    // console.log("Client: " + JSON.stringify(await client.getUser()));
  }
  app.config.globalProperties.$auth = authPlugin;
  router.beforeEach(routeGuard);
});