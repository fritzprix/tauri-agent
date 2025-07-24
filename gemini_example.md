// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
  GoogleGenAI,
  Type,
} from '@google/genai';

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const tools = [
    {
      functionDeclarations: [
        {
          name: 'getname',
          description: 'get user name',
          parameters: {
            type: Type.OBJECT,
            required: ["id"],
            properties: {
              id: {
                type: Type.STRING,
              },
            },
          },
        },
      ],
    }
  ];
  const config = {
    thinkingConfig: {
      thinkingBudget: -1,
    },
    tools,
    responseMimeType: 'text/plain',
    systemInstruction: [
        {
          text: `you are helpful assistant`,
        }
    ],
  };
  const model = 'gemini-2.5-pro';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });
  let fileIndex = 0;
  for await (const chunk of response) {
    console.log(chunk.functionCalls ? chunk.functionCalls[0] : chunk.text);
  }
}

main();
