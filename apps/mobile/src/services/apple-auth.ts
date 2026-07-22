import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AppleCredentialPayload } from './api';

function requireIdentityToken(identityToken: string | null): string {
  if (!identityToken) {
    throw new Error('Apple did not return an identity token. Please try signing in again.');
  }
  return identityToken;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync();
}

export async function requestAppleSignIn(): Promise<AppleCredentialPayload> {
  if (!(await isAppleSignInAvailable())) {
    throw new Error('Sign in with Apple is available in the iOS app.');
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ') || null;
  return {
    appleId: credential.user,
    identityToken: requireIdentityToken(credential.identityToken),
    authorizationCode: credential.authorizationCode,
    email: credential.email,
    displayName,
  };
}

export async function requestAppleReauthentication(challenge: string): Promise<string> {
  if (!(await isAppleSignInAvailable())) {
    throw new Error('Apple reauthentication is available in the iOS app.');
  }
  const credential = await AppleAuthentication.signInAsync({ nonce: challenge });
  return requireIdentityToken(credential.identityToken);
}
