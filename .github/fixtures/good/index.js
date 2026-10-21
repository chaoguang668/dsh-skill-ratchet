export const name = 'dsh-ci-good-fixture'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'ci_good_echo',
    description: 'Return the supplied text unchanged.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to return.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return args.text
    },
  })
}
