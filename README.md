# PGMMV Collision Plugin

[![CI](https://github.com/kidthales/pgmmv-collision-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/pgmmv-collision-plugin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Utilities for working with 2D collisions in [PGMMV](https://rpgmakerofficial.com/product/act/en/manual/01_01.html).

| Link Condition            | Description                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On Wall or Slope          | Test if object instance bottom wall collision is touching a tile wall or object instance is touching a slope from the top. Leaving the tile group inputs unset will use the default tile group. |
| On Slope Facing Downslope | Test if object instance is touching a slope from the top and facing downslope.                                                                                                                  |
| On Slope Facing Upslope   | Test if object instance is touching a slope from the top and facing upslope.                                                                                                                    |
