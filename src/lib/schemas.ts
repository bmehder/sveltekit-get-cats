import { z } from 'zod'

// Validation Schemas
export const AnimalResponseSchema = z.object({
	id: z.string().nonempty(),
	url: z.httpUrl(),
})

export const AnimalsResponseSchema = z.array(AnimalResponseSchema)
