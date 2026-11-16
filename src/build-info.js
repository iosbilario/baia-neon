/* SPDX-License-Identifier: MIT */
window.BN = window.BN || {};
BN.BUILD_INFO = Object.freeze({
  version: BN.CONFIG ? BN.CONFIG.version : '0.3.0',
  tag: 'development',
  sha: 'development',
  channel: 'development'
});
