/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/f2f.json`.
 */
export type F2f = {
  "address": "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm",
  "metadata": {
    "name": "f2f",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Field-to-Finance program"
  },
  "instructions": [
    {
      "name": "addProject",
      "discriminator": [
        97,
        192,
        178,
        11,
        126,
        16,
        196,
        5
      ],
      "accounts": [
        {
          "name": "issuer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "approveInvestor",
      "discriminator": [
        54,
        39,
        39,
        78,
        3,
        23,
        157,
        160
      ],
      "accounts": [
        {
          "name": "compliance",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "investor"
        },
        {
          "name": "investorRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeSubscription",
      "discriminator": [
        33,
        214,
        169,
        135,
        35,
        127,
        78,
        7
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createPool",
      "discriminator": [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "poolId"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "poolId",
          "type": "u64"
        },
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createPoolArgs"
            }
          }
        }
      ]
    },
    {
      "name": "disburse",
      "discriminator": [
        68,
        250,
        205,
        89,
        217,
        142,
        13,
        44
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true
        },
        {
          "name": "producer"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "producerUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "producer"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "poolTerms",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  101,
                  114,
                  109,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "feeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryUsdc",
          "writable": true,
          "optional": true
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "electSettlement",
      "discriminator": [
        243,
        14,
        35,
        136,
        101,
        133,
        194,
        74
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "instrumentTerms",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "election",
          "type": {
            "defined": {
              "name": "settlementElection"
            }
          }
        }
      ]
    },
    {
      "name": "fundRedemption",
      "discriminator": [
        63,
        242,
        144,
        13,
        107,
        199,
        16,
        159
      ],
      "accounts": [
        {
          "name": "issuer",
          "docs": [
            "The arranger (Config.issuer) or the pool's issuer of record (`Pool.issuer`, the farmer for",
            "pilot pools; the same platform key for older pools)."
          ],
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "issuerUsdc",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "instrumentTerms",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "issuer",
          "type": "pubkey"
        },
        {
          "name": "scas",
          "type": "pubkey"
        },
        {
          "name": "compliance",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initFeeConfig",
      "discriminator": [
        212,
        138,
        200,
        114,
        73,
        176,
        7,
        197
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "treasuryUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "networkFee",
          "type": "u64"
        },
        {
          "name": "mintFee",
          "type": "u64"
        },
        {
          "name": "maxArrangementBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "openPool",
      "discriminator": [
        96,
        215,
        110,
        61,
        1,
        246,
        205,
        228
      ],
      "accounts": [
        {
          "name": "issuer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "instrumentTerms",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "recordAttestation",
      "discriminator": [
        148,
        43,
        225,
        77,
        15,
        134,
        217,
        54
      ],
      "accounts": [
        {
          "name": "scas",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true
        },
        {
          "name": "field",
          "writable": true
        },
        {
          "name": "attestation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  115,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "field"
              },
              {
                "kind": "account",
                "path": "field.attestationCount",
                "account": "field"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "attestationKind"
            }
          }
        },
        {
          "name": "verdict",
          "type": {
            "defined": {
              "name": "verdict"
            }
          }
        },
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "evidenceUri",
          "type": "string"
        },
        {
          "name": "ndviMeanX10k",
          "type": "i16"
        },
        {
          "name": "sceneDate",
          "type": "i64"
        }
      ]
    },
    {
      "name": "recordDelivery",
      "discriminator": [
        72,
        245,
        251,
        211,
        129,
        177,
        93,
        214
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "instrumentTerms",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "project"
        },
        {
          "name": "field",
          "writable": true
        },
        {
          "name": "attestation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  115,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "field"
              },
              {
                "kind": "account",
                "path": "field.attestationCount",
                "account": "field"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "attestationKind"
            }
          }
        },
        {
          "name": "verdict",
          "type": {
            "defined": {
              "name": "verdict"
            }
          }
        },
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "evidenceUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "recordSettlement",
      "discriminator": [
        225,
        116,
        158,
        209,
        29,
        96,
        45,
        32
      ],
      "accounts": [
        {
          "name": "issuer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "rule",
          "type": {
            "defined": {
              "name": "settlementRule"
            }
          }
        }
      ]
    },
    {
      "name": "redeem",
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "investor",
          "signer": true
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "investorInstrument",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "investorUsdc",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "instrumentTerms",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeemDelivery",
      "discriminator": [
        57,
        5,
        191,
        174,
        159,
        28,
        137,
        49
      ],
      "accounts": [
        {
          "name": "investor",
          "signer": true
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "instrumentTerms",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "investorInstrument",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "refund",
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "investor",
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "investorInstrument",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "investorUsdc",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerField",
      "discriminator": [
        97,
        110,
        85,
        16,
        38,
        138,
        29,
        159
      ],
      "accounts": [
        {
          "name": "producer",
          "signer": true,
          "relations": [
            "project"
          ]
        },
        {
          "name": "payer",
          "docs": [
            "Pays rent for the field account: the platform gas sponsor, or the producer themself."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "project",
          "writable": true
        },
        {
          "name": "field",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "polygonHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "areaHaX100",
          "type": "u32"
        }
      ]
    },
    {
      "name": "registerProject",
      "discriminator": [
        130,
        150,
        121,
        216,
        183,
        225,
        243,
        192
      ],
      "accounts": [
        {
          "name": "producer",
          "signer": true
        },
        {
          "name": "payer",
          "docs": [
            "Pays rent for the project account: the platform gas sponsor, or the producer themself."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "producer"
              },
              {
                "kind": "arg",
                "path": "projectId"
              }
            ]
          }
        },
        {
          "name": "feeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "optional": true
        },
        {
          "name": "producerUsdc",
          "docs": [
            "Producer's USDC account that pays the mint fee; the producer signs the transfer."
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "treasuryUsdc",
          "writable": true,
          "optional": true
        },
        {
          "name": "usdcTokenProgram",
          "optional": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "projectId",
          "type": "u64"
        },
        {
          "name": "crop",
          "type": "string"
        },
        {
          "name": "season",
          "type": "u16"
        },
        {
          "name": "expectedKg",
          "type": "u64"
        },
        {
          "name": "requestedAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revokeInvestor",
      "discriminator": [
        81,
        196,
        65,
        97,
        158,
        243,
        172,
        101
      ],
      "accounts": [
        {
          "name": "compliance",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "investor"
        },
        {
          "name": "investorRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "investorInstrument",
          "docs": [
            "The investor's Instrument account in this pool, if they ever subscribed to it."
          ],
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "investor"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "setArrangementFee",
      "discriminator": [
        154,
        108,
        238,
        20,
        149,
        200,
        85,
        46
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "feeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "poolTerms",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  101,
                  114,
                  109,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setInstrumentTerms",
      "discriminator": [
        118,
        148,
        86,
        113,
        11,
        10,
        112,
        88
      ],
      "accounts": [
        {
          "name": "arranger",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "issuerOfRecord"
        },
        {
          "name": "issuerRecord",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "issuerOfRecord"
              }
            ]
          }
        },
        {
          "name": "instrumentTerms",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "instrumentTermsArgs"
            }
          }
        }
      ]
    },
    {
      "name": "subscribe",
      "discriminator": [
        254,
        28,
        191,
        138,
        156,
        179,
        183,
        53
      ],
      "accounts": [
        {
          "name": "investor",
          "signer": true
        },
        {
          "name": "payer",
          "docs": [
            "Pays rent for the Instrument account: the platform gas sponsor, or the investor themself."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "investorRecord",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "investorInstrument",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "investor"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "investorUsdc",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "feeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryUsdc",
          "writable": true,
          "optional": true
        },
        {
          "name": "instrumentTerms",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  116,
                  114,
                  117,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sweep",
      "discriminator": [
        40,
        23,
        234,
        175,
        14,
        61,
        154,
        177
      ],
      "accounts": [
        {
          "name": "issuer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.poolId",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "issuerUsdc",
          "writable": true
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "updateFeeConfig",
      "discriminator": [
        104,
        184,
        103,
        242,
        88,
        151,
        107,
        20
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "treasuryUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "networkFee",
          "type": "u64"
        },
        {
          "name": "mintFee",
          "type": "u64"
        },
        {
          "name": "maxArrangementBps",
          "type": "u16"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "attestation",
      "discriminator": [
        152,
        125,
        183,
        86,
        36,
        146,
        121,
        73
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "farmProject",
      "discriminator": [
        203,
        216,
        159,
        207,
        15,
        86,
        200,
        66
      ]
    },
    {
      "name": "feeConfig",
      "discriminator": [
        143,
        52,
        146,
        187,
        219,
        123,
        76,
        155
      ]
    },
    {
      "name": "field",
      "discriminator": [
        76,
        250,
        89,
        145,
        233,
        45,
        38,
        85
      ]
    },
    {
      "name": "instrumentTerms",
      "discriminator": [
        166,
        77,
        194,
        240,
        21,
        71,
        252,
        182
      ]
    },
    {
      "name": "investorRecord",
      "discriminator": [
        170,
        144,
        39,
        68,
        178,
        31,
        194,
        117
      ]
    },
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "poolTerms",
      "discriminator": [
        110,
        146,
        28,
        28,
        109,
        155,
        128,
        76
      ]
    }
  ],
  "events": [
    {
      "name": "arrangementFeeWithheld",
      "discriminator": [
        124,
        217,
        128,
        0,
        84,
        189,
        26,
        130
      ]
    },
    {
      "name": "grainClaim",
      "discriminator": [
        58,
        182,
        86,
        147,
        90,
        73,
        214,
        113
      ]
    },
    {
      "name": "mintFeeCharged",
      "discriminator": [
        87,
        110,
        14,
        192,
        49,
        0,
        49,
        99
      ]
    },
    {
      "name": "networkFeeCharged",
      "discriminator": [
        199,
        33,
        60,
        75,
        174,
        202,
        113,
        219
      ]
    },
    {
      "name": "settlementElected",
      "discriminator": [
        36,
        210,
        69,
        80,
        220,
        162,
        168,
        77
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Signer does not hold the required role"
    },
    {
      "code": 6001,
      "name": "invalidPremium",
      "msg": "Premium must be between 500 and 600 bps"
    },
    {
      "code": 6002,
      "name": "invalidYield",
      "msg": "Yield is out of range"
    },
    {
      "code": 6003,
      "name": "invalidSchedule",
      "msg": "Subscription close must be in the future and before maturity"
    },
    {
      "code": 6004,
      "name": "stringTooLong",
      "msg": "String is too long"
    },
    {
      "code": 6005,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6006,
      "name": "poolNotDraft",
      "msg": "Pool is not in Draft"
    },
    {
      "code": 6007,
      "name": "poolNotOpen",
      "msg": "Pool is not Open"
    },
    {
      "code": 6008,
      "name": "poolNotFunded",
      "msg": "Pool is not Funded"
    },
    {
      "code": 6009,
      "name": "poolNotRefunding",
      "msg": "Pool is not Refunding"
    },
    {
      "code": 6010,
      "name": "poolNotRedeeming",
      "msg": "Pool is not Redeeming"
    },
    {
      "code": 6011,
      "name": "noProjects",
      "msg": "Pool has no projects"
    },
    {
      "code": 6012,
      "name": "projectAlreadyInPool",
      "msg": "Project is already in a pool"
    },
    {
      "code": 6013,
      "name": "projectNotInPool",
      "msg": "Project is not in this pool"
    },
    {
      "code": 6014,
      "name": "cropMismatch",
      "msg": "Project crop or season does not match the pool"
    },
    {
      "code": 6015,
      "name": "noFields",
      "msg": "Project has no fields"
    },
    {
      "code": 6016,
      "name": "tooManyFields",
      "msg": "Too many fields"
    },
    {
      "code": 6017,
      "name": "fieldsNotVerified",
      "msg": "Every field must be verified"
    },
    {
      "code": 6018,
      "name": "projectLocked",
      "msg": "Fields cannot change after the project joins a pool"
    },
    {
      "code": 6019,
      "name": "fieldMismatch",
      "msg": "Field does not belong to this project"
    },
    {
      "code": 6020,
      "name": "invalidNdvi",
      "msg": "NDVI must be between -1 and 1"
    },
    {
      "code": 6021,
      "name": "subscriptionClosed",
      "msg": "Subscription period has ended"
    },
    {
      "code": 6022,
      "name": "subscriptionStillOpen",
      "msg": "Subscription is still open"
    },
    {
      "code": 6023,
      "name": "exceedsTarget",
      "msg": "Subscription exceeds the pool target"
    },
    {
      "code": 6024,
      "name": "investorNotApproved",
      "msg": "Investor is not approved"
    },
    {
      "code": 6025,
      "name": "alreadyDisbursed",
      "msg": "Project was already disbursed"
    },
    {
      "code": 6026,
      "name": "notDisbursed",
      "msg": "Project was not disbursed"
    },
    {
      "code": 6027,
      "name": "harvestNotAttested",
      "msg": "Harvest has not been attested"
    },
    {
      "code": 6028,
      "name": "alreadySettled",
      "msg": "Project is already settled"
    },
    {
      "code": 6029,
      "name": "notAllDisbursed",
      "msg": "Every project must be disbursed before redemption funding"
    },
    {
      "code": 6030,
      "name": "instrumentOutstanding",
      "msg": "Instrument is still outstanding"
    },
    {
      "code": 6031,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6032,
      "name": "feeTooHigh",
      "msg": "Fee is above the allowed cap"
    },
    {
      "code": 6033,
      "name": "invalidTreasury",
      "msg": "Treasury account is not the fee treasury's USDC account"
    },
    {
      "code": 6034,
      "name": "missingFeeAccount",
      "msg": "A fee is due but its accounts were not provided"
    },
    {
      "code": 6035,
      "name": "issuerNotApproved",
      "msg": "Issuer of record has no approved KYC record"
    },
    {
      "code": 6036,
      "name": "issuerMismatch",
      "msg": "Project or terms do not match the pool's issuer of record"
    },
    {
      "code": 6037,
      "name": "invalidTerms",
      "msg": "Instrument terms are invalid"
    },
    {
      "code": 6038,
      "name": "invalidCoupon",
      "msg": "Coupon is above the allowed cap"
    },
    {
      "code": 6039,
      "name": "unsupportedDayCount",
      "msg": "Day count is not supported"
    },
    {
      "code": 6040,
      "name": "notWholeTokens",
      "msg": "Amount must be a whole number of tokens"
    },
    {
      "code": 6041,
      "name": "targetNotWholeTokens",
      "msg": "Pool target must be a whole number of tokens"
    },
    {
      "code": 6042,
      "name": "notHybrid",
      "msg": "Settlement election applies only to Hybrid instruments"
    },
    {
      "code": 6043,
      "name": "alreadyElected",
      "msg": "Settlement was already elected"
    },
    {
      "code": 6044,
      "name": "electionClosed",
      "msg": "Settlement election closed at maturity"
    },
    {
      "code": 6045,
      "name": "deliveryNotElected",
      "msg": "Grain delivery is not the settlement for this pool"
    },
    {
      "code": 6046,
      "name": "deliveryElected",
      "msg": "Grain delivery was elected; cash redemption is closed"
    },
    {
      "code": 6047,
      "name": "deliveryNotAttested",
      "msg": "Elevator receipt and a passing lab certificate are required"
    },
    {
      "code": 6048,
      "name": "invalidAttestationKind",
      "msg": "Attestation kind is not allowed here"
    },
    {
      "code": 6049,
      "name": "notMatured",
      "msg": "Maturity has not been reached"
    },
    {
      "code": 6050,
      "name": "electionPending",
      "msg": "Cash is accepted only after the issuer elects buyback"
    }
  ],
  "types": [
    {
      "name": "arrangementFeeWithheld",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "requested",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "net",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "attestation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field",
            "type": "pubkey"
          },
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "sequence",
            "type": "u32"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "attestationKind"
              }
            }
          },
          {
            "name": "verdict",
            "type": {
              "defined": {
                "name": "verdict"
              }
            }
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "evidenceUri",
            "type": "string"
          },
          {
            "name": "ndviMeanX10k",
            "type": "i16"
          },
          {
            "name": "sceneDate",
            "type": "i64"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "recordedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "attestationKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "fieldVerified"
          },
          {
            "name": "sowing"
          },
          {
            "name": "vegetation"
          },
          {
            "name": "harvest"
          },
          {
            "name": "elevatorReceipt"
          },
          {
            "name": "labQuality"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "scas",
            "type": "pubkey"
          },
          {
            "name": "compliance",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "createPoolArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "crop",
            "type": "string"
          },
          {
            "name": "season",
            "type": "u16"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "yieldBps",
            "type": "u16"
          },
          {
            "name": "premiumBps",
            "type": "u16"
          },
          {
            "name": "subscriptionCloseTs",
            "type": "i64"
          },
          {
            "name": "maturityTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "dayCount",
      "docs": [
        "Interest day count. Only Act/360 is supported; Act/365 is reserved for later terms."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "act360"
          },
          {
            "name": "act365"
          }
        ]
      }
    },
    {
      "name": "farmProject",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "producer",
            "type": "pubkey"
          },
          {
            "name": "projectId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "crop",
            "type": "string"
          },
          {
            "name": "season",
            "type": "u16"
          },
          {
            "name": "expectedKg",
            "type": "u64"
          },
          {
            "name": "tokenizedKg",
            "type": "u64"
          },
          {
            "name": "requestedAmount",
            "type": "u64"
          },
          {
            "name": "fieldCount",
            "type": "u8"
          },
          {
            "name": "verifiedFieldCount",
            "type": "u8"
          },
          {
            "name": "harvestAttested",
            "type": "bool"
          },
          {
            "name": "disbursed",
            "type": "bool"
          },
          {
            "name": "settlement",
            "type": {
              "option": {
                "defined": {
                  "name": "settlementRule"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "feeConfig",
      "docs": [
        "Platform fee settings. Singleton PDA `[\"fees\"]`, controlled by `Config.admin`.",
        "Fees are charged only while this account exists; old deployments without it charge nothing."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasury",
            "docs": [
              "Wallet that receives every fee; fees land in its USDC associated token account."
            ],
            "type": "pubkey"
          },
          {
            "name": "networkFee",
            "docs": [
              "USDC base units added to each subscription, paid by the investor."
            ],
            "type": "u64"
          },
          {
            "name": "mintFee",
            "docs": [
              "USDC base units prepaid by the producer at `register_project`."
            ],
            "type": "u64"
          },
          {
            "name": "maxArrangementBps",
            "docs": [
              "Upper bound for `PoolTerms.arrangement_fee_bps`, itself at most `MAX_ARRANGEMENT_BPS`."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "field",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "polygonHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "areaHaX100",
            "type": "u32"
          },
          {
            "name": "verified",
            "type": "bool"
          },
          {
            "name": "attestationCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "grainClaim",
      "docs": [
        "An investor burned `amount` Instrument base units for `kg` of grain at the elevator.",
        "Off-chain, the claim is honoured against the elevator receipt and later maps to a",
        "grain-receipt token on CommodityChain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "investor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "kg",
            "type": "u64"
          },
          {
            "name": "receiptHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "instrumentTerms",
      "docs": [
        "Instrument terms from the term sheet, PDA `[\"instrument\", pool]`. Set by the arranger while the pool",
        "is Draft, usually in the same transaction as `create_pool`. Pools without it keep the flat-yield path."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "unitNominal",
            "docs": [
              "USDC base units per whole token (pilot: 100,000 USDC). Subscriptions are whole multiples."
            ],
            "type": "u64"
          },
          {
            "name": "couponBpsAnnual",
            "type": "u16"
          },
          {
            "name": "dayCount",
            "type": {
              "defined": {
                "name": "dayCount"
              }
            }
          },
          {
            "name": "startTs",
            "docs": [
              "Interest accrues from here to `Pool.maturity_ts`, counted in whole days."
            ],
            "type": "i64"
          },
          {
            "name": "settlementMode",
            "type": {
              "defined": {
                "name": "settlementMode"
              }
            }
          },
          {
            "name": "volumeKg",
            "docs": [
              "Contracted harvest volume (pilot: 10,000 t)."
            ],
            "type": "u64"
          },
          {
            "name": "tokenizedShareBps",
            "docs": [
              "Share of `volume_kg` backing the tokens, at most 30%."
            ],
            "type": "u16"
          },
          {
            "name": "qualitySpecHash",
            "docs": [
              "SHA-256 of the quality spec JSON (the 12 commodity parameters), stored off-chain like evidence."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "specUri",
            "type": "string"
          },
          {
            "name": "elevator",
            "type": "string"
          },
          {
            "name": "lab",
            "type": "string"
          },
          {
            "name": "election",
            "docs": [
              "Hybrid only: the issuer's election, made at most once and no later than maturity."
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "settlementElection"
                }
              }
            }
          },
          {
            "name": "electedAt",
            "type": "i64"
          },
          {
            "name": "receiptHash",
            "docs": [
              "Evidence hash of the latest passing elevator receipt; zero until recorded."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "labCertHash",
            "docs": [
              "Evidence hash of the latest lab certificate and whether it passed."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "labPassed",
            "type": "bool"
          },
          {
            "name": "deliveredKg",
            "docs": [
              "Kilograms already claimed through `redeem_delivery`."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "instrumentTermsArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "unitNominal",
            "type": "u64"
          },
          {
            "name": "couponBpsAnnual",
            "type": "u16"
          },
          {
            "name": "dayCount",
            "type": {
              "defined": {
                "name": "dayCount"
              }
            }
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "settlementMode",
            "type": {
              "defined": {
                "name": "settlementMode"
              }
            }
          },
          {
            "name": "volumeKg",
            "type": "u64"
          },
          {
            "name": "tokenizedShareBps",
            "type": "u16"
          },
          {
            "name": "qualitySpecHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "specUri",
            "type": "string"
          },
          {
            "name": "elevator",
            "type": "string"
          },
          {
            "name": "lab",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "investorRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "approved",
            "type": "bool"
          },
          {
            "name": "approvedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "mintFeeCharged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "producer",
            "type": "pubkey"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "networkFeeCharged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "investor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "crop",
            "type": "string"
          },
          {
            "name": "season",
            "type": "u16"
          },
          {
            "name": "targetAmount",
            "type": "u64"
          },
          {
            "name": "raisedAmount",
            "type": "u64"
          },
          {
            "name": "yieldBps",
            "type": "u16"
          },
          {
            "name": "premiumBps",
            "type": "u16"
          },
          {
            "name": "subscriptionCloseTs",
            "type": "i64"
          },
          {
            "name": "maturityTs",
            "type": "i64"
          },
          {
            "name": "projectCount",
            "type": "u16"
          },
          {
            "name": "disbursedCount",
            "type": "u16"
          },
          {
            "name": "settledCount",
            "type": "u16"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "poolStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "mintBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "poolStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "draft"
          },
          {
            "name": "open"
          },
          {
            "name": "funded"
          },
          {
            "name": "refunding"
          },
          {
            "name": "redeeming"
          }
        ]
      }
    },
    {
      "name": "poolTerms",
      "docs": [
        "Per-pool commercial terms, PDA `[\"terms\", pool]`. Set by the Issuer while the pool is Draft.",
        "A pool without this account (every pool created before fees) has a zero arrangement fee."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "arrangementFeeBps",
            "docs": [
              "Share of each project's requested amount withheld for the treasury at disbursement."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "settlementElected",
      "docs": [
        "Settlement chosen for a Hybrid Instrument."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "election",
            "type": {
              "defined": {
                "name": "settlementElection"
              }
            }
          }
        ]
      }
    },
    {
      "name": "settlementElection",
      "docs": [
        "The issuer's choice for a Hybrid Instrument."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "buyback"
          },
          {
            "name": "delivery"
          }
        ]
      }
    },
    {
      "name": "settlementMode",
      "docs": [
        "How the Instrument settles at maturity."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "cashBuyback"
          },
          {
            "name": "grainDelivery"
          },
          {
            "name": "hybrid"
          }
        ]
      }
    },
    {
      "name": "settlementRule",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "delivered"
          },
          {
            "name": "coveredFromOtherFields"
          },
          {
            "name": "boughtOnMarket"
          },
          {
            "name": "cashRepaidWithPremium"
          }
        ]
      }
    },
    {
      "name": "verdict",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pass"
          },
          {
            "name": "fail"
          },
          {
            "name": "insufficientData"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "attestationSeed",
      "type": "bytes",
      "value": "[97, 116, 116, 101, 115, 116, 97, 116, 105, 111, 110]"
    },
    {
      "name": "buybackGraceSecs",
      "docs": [
        "After maturity an elected but unfunded buyback lapses into delivery once this grace period passes (7 days)."
      ],
      "type": "i64",
      "value": "604800"
    },
    {
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "feesSeed",
      "type": "bytes",
      "value": "[102, 101, 101, 115]"
    },
    {
      "name": "fieldSeed",
      "type": "bytes",
      "value": "[102, 105, 101, 108, 100]"
    },
    {
      "name": "instrumentSeed",
      "type": "bytes",
      "value": "[105, 110, 115, 116, 114, 117, 109, 101, 110, 116]"
    },
    {
      "name": "investorSeed",
      "type": "bytes",
      "value": "[105, 110, 118, 101, 115, 116, 111, 114]"
    },
    {
      "name": "maxArrangementBps",
      "docs": [
        "Hard ceiling for any pool's arrangement fee, whatever FeeConfig says (10%)."
      ],
      "type": "u16",
      "value": "1000"
    },
    {
      "name": "maxCouponBps",
      "docs": [
        "Hard ceiling for an Instrument's annual coupon (30%)."
      ],
      "type": "u16",
      "value": "3000"
    },
    {
      "name": "maxMintFee",
      "docs": [
        "Hard ceiling for the project mint fee: 50 USDC."
      ],
      "type": "u64",
      "value": "50000000"
    },
    {
      "name": "maxNetworkFee",
      "docs": [
        "Hard ceiling for the per-subscription network fee: 10 USDC."
      ],
      "type": "u64",
      "value": "10000000"
    },
    {
      "name": "maxTermDays",
      "docs": [
        "Longest interest period from `InstrumentTerms.start_ts` to maturity, in days (about five years)."
      ],
      "type": "i64",
      "value": "1830"
    },
    {
      "name": "mintSeed",
      "type": "bytes",
      "value": "[109, 105, 110, 116]"
    },
    {
      "name": "poolSeed",
      "type": "bytes",
      "value": "[112, 111, 111, 108]"
    },
    {
      "name": "projectSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 106, 101, 99, 116]"
    },
    {
      "name": "termsSeed",
      "type": "bytes",
      "value": "[116, 101, 114, 109, 115]"
    }
  ]
};
