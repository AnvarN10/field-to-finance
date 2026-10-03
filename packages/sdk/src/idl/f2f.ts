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
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
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
          "writable": true,
          "signer": true,
          "relations": [
            "project"
          ]
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
          "writable": true,
          "signer": true
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
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
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
    }
  ],
  "types": [
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
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "fieldSeed",
      "type": "bytes",
      "value": "[102, 105, 101, 108, 100]"
    },
    {
      "name": "investorSeed",
      "type": "bytes",
      "value": "[105, 110, 118, 101, 115, 116, 111, 114]"
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
    }
  ]
};
