import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createPaymentIntent(amount: number) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
  })
}
