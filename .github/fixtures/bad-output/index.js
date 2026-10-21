export const name = 'dsh-ci-bad-output-fixture'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'ci_bad_output_echo',
    description: 'Deliberately uses type:json in the output schema (must fail).',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to return.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          value: { type: 'json' },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      return { value: args.text }
    },
  })
}
