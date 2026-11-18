export const CHAT_CONTRACT={
  "openapi": "3.1.0",
  "info": {
    "title": "吉政知行对话服务",
    "version": "1.0",
    "description": "吉林本地文旅资料、政务导办、候选行程及内容创作。无实时预订、外部写入与真实身份授权。"
  },
  "paths": {
    "/api/v1/chat": {
      "post": {
        "operationId": "chat",
        "description": "外部客户端使用独立服务访问码。历史由客户端传入，最多四轮，不在服务端持久化。",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ChatRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "对话结果；partial 不等于完整成功",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ChatResult"
                }
              }
            }
          },
          "400": {
            "description": "请求体不合法"
          },
          "401": {
            "description": "访问码不正确"
          },
          "403": {
            "description": "不允许的浏览器来源"
          },
          "429": {
            "description": "请求过多"
          },
          "503": {
            "description": "服务不可用或未配置"
          }
        }
      }
    },
    "/api/v1/portal/status": {
      "get": {
        "operationId": "portalStatus",
        "description": "业务服务配置状态",
        "security": [],
        "responses": {
          "200": {
            "description": "成功"
          },
          "400": {
            "description": "无效输入"
          },
          "401": {
            "description": "无有效身份"
          },
          "403": {
            "description": "没有权限"
          },
          "404": {
            "description": "资源不可访问"
          },
          "409": {
            "description": "请求 ID 与原始内容冲突"
          },
          "429": {
            "description": "限流"
          },
          "503": {
            "description": "业务服务不可用"
          }
        }
      }
    },
    "/api/v1/portal/me": {
      "get": {
        "operationId": "portalMe",
        "description": "服务端识别当前角色",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "成功"
          },
          "400": {
            "description": "无效输入"
          },
          "401": {
            "description": "无有效身份"
          },
          "403": {
            "description": "没有权限"
          },
          "404": {
            "description": "资源不可访问"
          },
          "409": {
            "description": "请求 ID 与原始内容冲突"
          },
          "429": {
            "description": "限流"
          },
          "503": {
            "description": "业务服务不可用"
          }
        }
      }
    },
    "/api/v1/portal/merchants": {
      "get": {
        "operationId": "portalMerchants",
        "description": "游客所在地区已开放商户",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "成功"
          },
          "400": {
            "description": "无效输入"
          },
          "401": {
            "description": "无有效身份"
          },
          "403": {
            "description": "没有权限"
          },
          "404": {
            "description": "资源不可访问"
          },
          "409": {
            "description": "请求 ID 与原始内容冲突"
          },
          "429": {
            "description": "限流"
          },
          "503": {
            "description": "业务服务不可用"
          }
        }
      }
    },
    "/api/v1/portal/feedback": {
      "get": {
        "operationId": "listFeedback",
        "description": "读取当前凭证授权的数据",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "成功"
          },
          "400": {
            "description": "无效输入"
          },
          "401": {
            "description": "无有效身份"
          },
          "403": {
            "description": "没有权限"
          },
          "404": {
            "description": "资源不可访问"
          },
          "409": {
            "description": "请求 ID 与原始内容冲突"
          },
          "429": {
            "description": "限流"
          },
          "503": {
            "description": "业务服务不可用"
          }
        }
      },
      "post": {
        "operationId": "submitFeedback",
        "description": "仅游客；确认后写入反馈，requestId 幂等",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "merchantId": {
                    "type": "string"
                  },
                  "category": {
                    "type": "string",
                    "enum": [
                      "服务态度",
                      "设施与环境",
                      "价格与收费",
                      "安全问题",
                      "其他"
                    ]
                  },
                  "text": {
                    "type": "string",
                    "maxLength": 500
                  },
                  "requestId": {
                    "type": "string"
                  }
                },
                "required": [
                  "merchantId",
                  "category",
                  "text",
                  "requestId"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功"
          },
          "201": {
            "description": "已写入"
          },
          "400": {
            "description": "无效输入"
          },
          "401": {
            "description": "无有效身份"
          },
          "403": {
            "description": "没有权限"
          },
          "404": {
            "description": "资源不可访问"
          },
          "409": {
            "description": "请求 ID 与原始内容冲突"
          },
          "429": {
            "description": "限流"
          },
          "503": {
            "description": "业务服务不可用"
          }
        }
      }
    },
    "/api/v1/portal/feedback/{id}/replies": {
      "post": {
        "operationId": "replyFeedback",
        "description": "仅授权商户或管理人员；确认后答复",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string",
                    "maxLength": 400
                  },
                  "requestId": {
                    "type": "string"
                  }
                },
                "required": [
                  "text",
                  "requestId"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功"
          },
          "201": {
            "description": "已写入"
          },
          "400": {
            "description": "无效输入"
          },
          "401": {
            "description": "无有效身份"
          },
          "403": {
            "description": "没有权限"
          },
          "404": {
            "description": "资源不可访问"
          },
          "409": {
            "description": "请求 ID 与原始内容冲突"
          },
          "429": {
            "description": "限流"
          },
          "503": {
            "description": "业务服务不可用"
          }
        },
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/api/v1/images/status": {
      "get": {
        "operationId": "imageStatus",
        "responses": {
          "200": {
            "description": "是否配置素材服务"
          }
        }
      }
    },
    "/api/v1/images": {
      "post": {
        "operationId": "generateImage",
        "description": "仅在确认且授权的环境调用单张图像生成；不自动发布",
        "security": [
          {
            "imageAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "prompt",
                  "confirm"
                ],
                "properties": {
                  "prompt": {
                    "type": "string",
                    "maxLength": 1400
                  },
                  "confirm": {
                    "const": true
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "真实模型返回的 JPEG 图像，MIME 与 base64 字段"
          },
          "400": {
            "description": "未确认或描述无效"
          },
          "401": {
            "description": "访问凭证无效"
          },
          "429": {
            "description": "限流"
          },
          "502": {
            "description": "模型返回非图像"
          },
          "503": {
            "description": "未启用或服务不可用"
          }
        }
      }
    },
    "/api/v1/portal/summary": {
      "get": {
        "operationId": "feedbackSummary",
        "description": "商户及管理人员读取当前授权范围内全部反馈的分类统计，不含原文、账号或凭证",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "真实分类汇总、待答复和已答复数量"
          },
          "403": {
            "description": "身份无权访问"
          },
          "503": {
            "description": "服务不可用"
          }
        }
      }
    },
    "/api/v1/portal/analysis": {
      "post": {
        "operationId": "analyzeFeedback",
        "description": "明确确认后对授权统计进行模型分析；原始反馈不进入模型",
        "security": [
          {
            "portalAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "question",
                  "confirm"
                ],
                "properties": {
                  "question": {
                    "type": "string",
                    "maxLength": 300
                  },
                  "confirm": {
                    "const": true
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "实际统计及 complete/partial 分析结果"
          },
          "400": {
            "description": "未确认或问题无效"
          },
          "403": {
            "description": "身份无权访问"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      },
      "portalAuth": {
        "type": "http",
        "scheme": "bearer",
        "description": "独立、按角色签发的业务凭证，不是聊天访问码"
      },
      "imageAuth": {
        "type": "http",
        "scheme": "bearer",
        "description": "素材服务独立访问凭证"
      }
    },
    "schemas": {
      "ChatRequest": {
        "type": "object",
        "required": [
          "question"
        ],
        "properties": {
          "question": {
            "type": "string",
            "minLength": 1,
            "maxLength": 600
          },
          "region": {
            "type": "string",
            "enum": [
              "长春市",
              "吉林市",
              "四平市",
              "辽源市",
              "通化市",
              "白山市",
              "松原市",
              "白城市",
              "延边州"
            ]
          },
          "history": {
            "type": "array",
            "maxItems": 8,
            "description": "完整 user/assistant 成对交替",
            "items": {
              "type": "object",
              "required": [
                "role",
                "content"
              ],
              "properties": {
                "role": {
                  "enum": [
                    "user",
                    "assistant"
                  ]
                },
                "content": {
                  "type": "string",
                  "maxLength": 1800
                }
              }
            }
          }
        }
      },
      "ChatResult": {
        "type": "object",
        "required": [
          "status",
          "text",
          "sources",
          "itinerary",
          "version",
          "toolCount"
        ],
        "properties": {
          "status": {
            "enum": [
              "complete",
              "partial",
              "unavailable"
            ]
          },
          "text": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "toolCount": {
            "type": "integer"
          },
          "sources": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "label",
                "url"
              ],
              "properties": {
                "label": {
                  "type": "string"
                },
                "url": {
                  "type": "string",
                  "format": "uri"
                }
              }
            }
          },
          "itinerary": {
            "type": [
              "object",
              "null"
            ],
            "description": "本地规划与校验的候选行程，含 days 和 plan；不代表实时核验",
            "properties": {
              "days": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3
              },
              "plan": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "day": {
                      "type": "integer"
                    },
                    "nodes": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "attractionId": {
                            "type": "string"
                          },
                          "name": {
                            "type": "string"
                          },
                          "slot": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "feedbackDraft": {
            "type": [
              "object",
              "null"
            ],
            "description": "仅准备草稿，未提交",
            "properties": {
              "category": {
                "type": "string",
                "enum": [
                  "服务态度",
                  "设施与环境",
                  "价格与收费",
                  "安全问题",
                  "其他"
                ]
              },
              "text": {
                "type": "string",
                "maxLength": 400
              }
            }
          },
          "posterDraft": {
            "type": [
              "object",
              "null"
            ],
            "description": "待用户确认的图像创作描述，并非已生成素材",
            "properties": {
              "prompt": {
                "type": "string",
                "maxLength": 1200
              }
            }
          }
        }
      }
    }
  }
};
