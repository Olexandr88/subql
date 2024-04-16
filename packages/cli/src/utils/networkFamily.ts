// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {NETWORK_FAMILY} from '@subql/common';

const lowerCaseFirst = (str: string) => str.charAt(0).toLowerCase() + str.slice(1);

function isNetwork(network: string): network is NETWORK_FAMILY {
  return network && lowerCaseFirst(network) in NETWORK_FAMILY;
}

// can be either lowerCased or UpperCased
export function getNetworkFamily(network: string): NETWORK_FAMILY {
  if (!isNetwork(network)) {
    throw new Error(`Network not found or unsupported network ${network}`);
  }
  return NETWORK_FAMILY[lowerCaseFirst(network) as unknown as keyof typeof NETWORK_FAMILY];
}
