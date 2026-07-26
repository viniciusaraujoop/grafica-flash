import { NextRequest } from "next/server";
import {
  POST as mercadoPagoPost,
} from "./route.mercado-pago";

export async function POST(request: NextRequest) {
  return mercadoPagoPost(request);
}
