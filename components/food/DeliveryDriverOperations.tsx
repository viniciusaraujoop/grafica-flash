'use client'

// ORCALY_DELIVERY_DRIVER_OPERATIONS_V1

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'

export type DriverDeliveryRecord = {
  id: string
  company_id: string
  order_id: string | null
  customer_name: string | null
  customer_phone: string | null
  address: string | null
  neighborhood: string | null
  delivery_fee: number | null
  payment_method_id: string | null
  status: string | null
  assigned_driver_id: string | null
  assigned_at: string | null
  dispatched_at: string | null
  delivered_at: string | null
  updated_at: string | null
}

export type DriverOrderRecord = {
  id: string
  nome: string | null
  telefone: string | null
  produto: string | null
  total_amount: number | null
  total: number | null
  valor_total: number | null
  payment_method: string | null
  payment_status: string | null
  address: string | null
  neighborhood: string | null
  created_at: string | null
}

export type DriverPaymentMethod = {
  id: string
  name: string
  type: string
  is_active: boolean | null
}

type DeliveryDriver = {
  id: string
  company_id: string
  name: string
  whatsapp: string
  vehicle_plate: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type AssignmentStatus =
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'canceled'
  | 'reassigned'

type SettlementStatus = 'pending' | 'settled' | 'waived'

type DeliveryAssignment = {
  id: string
  company_id: string
  delivery_id: string | null
  order_id: string | null
  driver_id: string | null
  driver_name: string
  driver_whatsapp: string | null
  vehicle_plate: string | null
  delivery_code: string | null
  customer_name: string | null
  customer_phone: string | null
  address: string | null
  neighborhood: string | null
  map_url: string | null
  payment_method: string | null
  payment_status: string | null
  order_total: number
  delivery_fee: number
  status: AssignmentStatus
  assigned_at: string
  out_for_delivery_at: string | null
  delivered_at: string | null
  settlement_status: SettlementStatus
  settled_at: string | null
  settlement_note: string | null
  created_at: string
  updated_at: string
}

type DriverForm = {
  name: string
  whatsapp: string
  vehicle_plate: string
  notes: string
}

type DeliveryPatch = Partial<
  Pick<
    DriverDeliveryRecord,
    | 'assigned_driver_id'
    | 'assigned_at'
    | 'dispatched_at'
    | 'status'
    | 'delivered_at'
    | 'updated_at'
  >
>

type ProviderProps = {
  companyId: string
  deliveries: DriverDeliveryRecord[]
  orders: DriverOrderRecord[]
  paymentMethods: DriverPaymentMethod[]
  onDeliveryPatch: (
    deliveryId: string,
    patch: DeliveryPatch,
  ) => void
  onMessage: (message: string) => void
  onError: (message: string) => void
  children: ReactNode
}

type ContextValue = {
  drivers: DeliveryDriver[]
  openDrivers: () => void
  openHistory: () => void
  openAssignment: (delivery: DriverDeliveryRecord) => void
  completeDelivery: (
    delivery: DriverDeliveryRecord,
  ) => Promise<void>
  getDriverForDelivery: (
    delivery: DriverDeliveryRecord,
  ) => DeliveryDriver | null
  getAssignmentForDelivery: (
    delivery: DriverDeliveryRecord,
  ) => DeliveryAssignment | null
  driverWhatsappForDelivery: (
    delivery: DriverDeliveryRecord,
  ) => string
}

const DriverOperationsContext =
  createContext<ContextValue | null>(null)

const emptyDriverForm: DriverForm = {
  name: '',
  whatsapp: '',
  vehicle_plate: '',
  notes: '',
}

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-[#071b3a] outline-none transition placeholder:text-slate-300 focus:border-[#0a4b9f] focus:ring-4 focus:ring-blue-100/70'

const labelClass =
  'grid gap-2 text-xs font-black uppercase tracking-[0.13em] text-slate-500'

function digits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappNumber(value?: string | null) {
  const clean = digits(value)
  if (!clean) return ''
  return clean.startsWith('55') ? clean : `55${clean}`
}

function whatsappUrl(
  value?: string | null,
  message?: string,
) {
  const number = whatsappNumber(value)
  if (!number) return ''
  const query = message
    ? `?text=${encodeURIComponent(message)}`
    : ''
  return `https://wa.me/${number}${query}`
}

function mapsUrl(
  address?: string | null,
  neighborhood?: string | null,
) {
  const query = [address, neighborhood]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ')

  if (!query) return ''

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}`
}

function deliveryCode(id: string) {
  return `#${String(id || '')
    .slice(0, 8)
    .toUpperCase()}`
}

function money(value?: number | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Não informado'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Não informado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function localDateKey(value?: string | null) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(
    2,
    '0',
  )
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizePlate(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7)
}

function orderTotal(order?: DriverOrderRecord | null) {
  return Number(
    order?.total_amount ??
      order?.total ??
      order?.valor_total ??
      0,
  )
}

function isPaidStatus(value?: string | null) {
  const normalized = String(value || '').toLowerCase()

  return [
    'paid',
    'approved',
    'pago',
    'aprovado',
    'confirmed',
    'confirmado',
  ].includes(normalized)
}

function assignmentStatusLabel(
  value: AssignmentStatus,
) {
  if (value === 'assigned') return 'Alocada'
  if (value === 'out_for_delivery') return 'Em rota'
  if (value === 'delivered') return 'Entregue'
  if (value === 'reassigned') return 'Realocada'
  return 'Cancelada'
}

function settlementLabel(
  value: SettlementStatus,
) {
  if (value === 'settled') {
    return 'Prestação conferida'
  }
  if (value === 'waived') {
    return 'Sem valor a prestar'
  }
  return 'Prestação pendente'
}

function allocationMessage(
  driver: Pick<
    DeliveryDriver,
    'name' | 'whatsapp' | 'vehicle_plate'
  >,
  delivery: DriverDeliveryRecord,
  order: DriverOrderRecord | null,
  paymentMethod: string,
  assignedAt: string,
) {
  const route = mapsUrl(
    delivery.address,
    delivery.neighborhood,
  )

  return [
    `Olá, ${driver.name}! Uma nova entrega foi alocada para você.`,
    '',
    `Pedido: ${deliveryCode(delivery.id)}`,
    `Cliente: ${
      delivery.customer_name || 'Cliente não informado'
    }`,
    `Horário da alocação: ${formatDateTime(
      assignedAt,
    )}`,
    `Endereço: ${
      delivery.address || 'Endereço não informado'
    }`,
    delivery.neighborhood
      ? `Bairro/área: ${delivery.neighborhood}`
      : '',
    paymentMethod
      ? `Pagamento: ${paymentMethod}`
      : '',
    orderTotal(order) > 0
      ? `Valor do pedido: ${money(orderTotal(order))}`
      : '',
    Number(delivery.delivery_fee || 0) > 0
      ? `Taxa de entrega: ${money(
          delivery.delivery_fee,
        )}`
      : '',
    route ? `Google Maps: ${route}` : '',
    '',
    'Confirme o recebimento da rota e avise quando a entrega for concluída.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function assignmentMessage(
  assignment: DeliveryAssignment,
) {
  return [
    `Olá, ${assignment.driver_name}! Seguem os dados da entrega.`,
    '',
    `Pedido: ${
      assignment.delivery_code ||
      deliveryCode(
        assignment.delivery_id || assignment.id,
      )
    }`,
    `Cliente: ${
      assignment.customer_name ||
      'Cliente não informado'
    }`,
    `Alocada em: ${formatDateTime(
      assignment.assigned_at,
    )}`,
    `Endereço: ${
      assignment.address || 'Endereço não informado'
    }`,
    assignment.neighborhood
      ? `Bairro/área: ${assignment.neighborhood}`
      : '',
    assignment.payment_method
      ? `Pagamento: ${assignment.payment_method}`
      : '',
    Number(assignment.order_total || 0) > 0
      ? `Valor do pedido: ${money(
          assignment.order_total,
        )}`
      : '',
    assignment.map_url
      ? `Google Maps: ${assignment.map_url}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function useDriverOperations() {
  const context = useContext(DriverOperationsContext)

  if (!context) {
    throw new Error(
      'As operações de entregadores precisam estar dentro do provider.',
    )
  }

  return context
}

export function DeliveryDriverProvider({
  companyId,
  deliveries,
  orders,
  paymentMethods,
  onDeliveryPatch,
  onMessage,
  onError,
  children,
}: ProviderProps) {
  const [drivers, setDrivers] = useState<
    DeliveryDriver[]
  >([])
  const [assignments, setAssignments] = useState<
    DeliveryAssignment[]
  >([])
  const [loadingOperations, setLoadingOperations] =
    useState(false)

  const [driversOpen, setDriversOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [assignmentDelivery, setAssignmentDelivery] =
    useState<DriverDeliveryRecord | null>(null)

  const [driverForm, setDriverForm] =
    useState<DriverForm>(emptyDriverForm)
  const [editingDriverId, setEditingDriverId] =
    useState<string | null>(null)
  const [selectedDriverId, setSelectedDriverId] =
    useState('')
  const [savingDriver, setSavingDriver] =
    useState(false)
  const [savingAssignment, setSavingAssignment] =
    useState(false)

  const [historyDate, setHistoryDate] = useState(
    localDateKey(),
  )
  const [historyDriverId, setHistoryDriverId] =
    useState('all')

  const orderMap = useMemo(
    () =>
      new Map(orders.map((order) => [order.id, order])),
    [orders],
  )

  const paymentMap = useMemo(
    () =>
      new Map(
        paymentMethods.map((method) => [
          method.id,
          method,
        ]),
      ),
    [paymentMethods],
  )

  const driverMap = useMemo(
    () =>
      new Map(
        drivers.map((driver) => [driver.id, driver]),
      ),
    [drivers],
  )

  const latestAssignmentMap = useMemo(() => {
    const map = new Map<string, DeliveryAssignment>()

    assignments.forEach((assignment) => {
      if (
        assignment.delivery_id &&
        !map.has(assignment.delivery_id)
      ) {
        map.set(assignment.delivery_id, assignment)
      }
    })

    return map
  }, [assignments])

  async function loadOperations() {
    if (!companyId) return

    setLoadingOperations(true)

    try {
      const [driversResult, assignmentsResult] =
        await Promise.all([
          supabase
            .from('delivery_drivers')
            .select(
              'id, company_id, name, whatsapp, vehicle_plate, notes, is_active, created_at, updated_at',
            )
            .eq('company_id', companyId)
            .order('is_active', { ascending: false })
            .order('name', { ascending: true }),
          supabase
            .from('delivery_assignments')
            .select(
              'id, company_id, delivery_id, order_id, driver_id, driver_name, driver_whatsapp, vehicle_plate, delivery_code, customer_name, customer_phone, address, neighborhood, map_url, payment_method, payment_status, order_total, delivery_fee, status, assigned_at, out_for_delivery_at, delivered_at, settlement_status, settled_at, settlement_note, created_at, updated_at',
            )
            .eq('company_id', companyId)
            .order('assigned_at', {
              ascending: false,
            })
            .limit(1000),
        ])

      if (driversResult.error) {
        throw driversResult.error
      }

      if (assignmentsResult.error) {
        throw assignmentsResult.error
      }

      setDrivers(
        (driversResult.data ||
          []) as DeliveryDriver[],
      )
      setAssignments(
        (assignmentsResult.data ||
          []) as DeliveryAssignment[],
      )
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar entregadores.',
      )
    } finally {
      setLoadingOperations(false)
    }
  }

  useEffect(() => {
    if (!companyId) return

    const timeout = window.setTimeout(() => {
      void loadOperations()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  function resetDriverForm() {
    setEditingDriverId(null)
    setDriverForm(emptyDriverForm)
  }

  function openDrivers() {
    resetDriverForm()
    setDriversOpen(true)
    onError('')
  }

  function openHistory() {
    setHistoryDate(localDateKey())
    setHistoryDriverId('all')
    setHistoryOpen(true)
    onError('')
  }

  function openAssignment(
    delivery: DriverDeliveryRecord,
  ) {
    const activeDrivers = drivers.filter(
      (driver) => driver.is_active,
    )

    if (!activeDrivers.length) {
      setDriversOpen(true)
      onError(
        'Cadastre pelo menos um entregador ativo antes de alocar a entrega.',
      )
      return
    }

    const validAssignedId =
      delivery.assigned_driver_id &&
      activeDrivers.some(
        (driver) =>
          driver.id === delivery.assigned_driver_id,
      )
        ? delivery.assigned_driver_id
        : activeDrivers[0].id

    setSelectedDriverId(validAssignedId)
    setAssignmentDelivery(delivery)
    onError('')
  }

  function editDriver(driver: DeliveryDriver) {
    setEditingDriverId(driver.id)
    setDriverForm({
      name: driver.name,
      whatsapp: driver.whatsapp,
      vehicle_plate: driver.vehicle_plate || '',
      notes: driver.notes || '',
    })
  }

  async function saveDriver(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!companyId) return

    const name = driverForm.name.trim()
    const whatsapp = driverForm.whatsapp.trim()
    const vehiclePlate = normalizePlate(
      driverForm.vehicle_plate,
    )

    if (name.length < 2) {
      onError('Informe o nome do entregador.')
      return
    }

    if (digits(whatsapp).length < 10) {
      onError('Informe um WhatsApp válido.')
      return
    }

    setSavingDriver(true)
    onError('')

    try {
      const now = new Date().toISOString()
      const payload = {
        company_id: companyId,
        name,
        whatsapp,
        vehicle_plate: vehiclePlate || null,
        notes: driverForm.notes.trim() || null,
        updated_at: now,
      }

      if (editingDriverId) {
        const { data, error } = await supabase
          .from('delivery_drivers')
          .update(payload)
          .eq('id', editingDriverId)
          .eq('company_id', companyId)
          .select(
            'id, company_id, name, whatsapp, vehicle_plate, notes, is_active, created_at, updated_at',
          )
          .single()

        if (error) throw error
        if (!data) {
          throw new Error(
            'Não foi possível atualizar o entregador.',
          )
        }

        setDrivers((current) =>
          current.map((driver) =>
            driver.id === editingDriverId
              ? (data as DeliveryDriver)
              : driver,
          ),
        )

        onMessage('Entregador atualizado.')
      } else {
        const { data, error } = await supabase
          .from('delivery_drivers')
          .insert({
            ...payload,
            is_active: true,
          })
          .select(
            'id, company_id, name, whatsapp, vehicle_plate, notes, is_active, created_at, updated_at',
          )
          .single()

        if (error) throw error
        if (!data) {
          throw new Error(
            'Não foi possível cadastrar o entregador.',
          )
        }

        setDrivers((current) => [
          data as DeliveryDriver,
          ...current,
        ])

        onMessage('Entregador cadastrado.')
      }

      resetDriverForm()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro ao salvar entregador.'
      const normalized = message.toLowerCase()

      onError(
        normalized.includes(
          'delivery_drivers_company_plate_uidx',
        ) ||
          normalized.includes('duplicate key')
          ? 'Essa placa já está vinculada a outro entregador.'
          : message,
      )
    } finally {
      setSavingDriver(false)
    }
  }

  async function toggleDriver(
    driver: DeliveryDriver,
  ) {
    if (!companyId) return

    const nextActive = !driver.is_active
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('delivery_drivers')
      .update({
        is_active: nextActive,
        updated_at: now,
      })
      .eq('id', driver.id)
      .eq('company_id', companyId)

    if (error) {
      onError(error.message)
      return
    }

    setDrivers((current) =>
      current.map((item) =>
        item.id === driver.id
          ? {
              ...item,
              is_active: nextActive,
              updated_at: now,
            }
          : item,
      ),
    )

    onMessage(
      nextActive
        ? 'Entregador reativado.'
        : 'Entregador desativado.',
    )
  }

  function getAssignmentForDelivery(
    delivery: DriverDeliveryRecord,
  ) {
    return latestAssignmentMap.get(delivery.id) || null
  }

  function getDriverForDelivery(
    delivery: DriverDeliveryRecord,
  ) {
    const assignment =
      getAssignmentForDelivery(delivery)

    if (delivery.assigned_driver_id) {
      return (
        driverMap.get(delivery.assigned_driver_id) || null
      )
    }

    if (assignment?.driver_id) {
      return driverMap.get(assignment.driver_id) || null
    }

    return null
  }

  function driverWhatsappForDelivery(
    delivery: DriverDeliveryRecord,
  ) {
    const assignment =
      getAssignmentForDelivery(delivery)
    const driver = getDriverForDelivery(delivery)

    if (!driver && !assignment) return ''

    const order = delivery.order_id
      ? orderMap.get(delivery.order_id) || null
      : null

    const paymentMethod = delivery.payment_method_id
      ? paymentMap.get(delivery.payment_method_id)?.name ||
        ''
      : order?.payment_method || ''

    const snapshot = {
      name:
        driver?.name ||
        assignment?.driver_name ||
        'Entregador',
      whatsapp:
        driver?.whatsapp ||
        assignment?.driver_whatsapp ||
        '',
      vehicle_plate:
        driver?.vehicle_plate ||
        assignment?.vehicle_plate ||
        null,
    }

    const assignedAt =
      assignment?.assigned_at ||
      delivery.assigned_at ||
      new Date().toISOString()

    return whatsappUrl(
      snapshot.whatsapp,
      allocationMessage(
        snapshot,
        delivery,
        order,
        paymentMethod,
        assignedAt,
      ),
    )
  }

  async function allocateDelivery() {
    if (
      !companyId ||
      !assignmentDelivery ||
      !selectedDriverId
    ) {
      return
    }

    const driver = driverMap.get(selectedDriverId)

    if (!driver || !driver.is_active) {
      onError('Selecione um entregador ativo.')
      return
    }

    setSavingAssignment(true)
    onError('')

    const delivery = assignmentDelivery
    const previousAssignment =
      latestAssignmentMap.get(delivery.id)
    const previousStatus =
      previousAssignment?.status || null

    try {
      const order = delivery.order_id
        ? orderMap.get(delivery.order_id) || null
        : null
      const paymentMethod = delivery.payment_method_id
        ? paymentMap.get(delivery.payment_method_id)
            ?.name || ''
        : order?.payment_method || ''
      const paymentStatus =
        order?.payment_status || null
      const now = new Date().toISOString()
      const route = mapsUrl(
        delivery.address,
        delivery.neighborhood,
      )

      const { data: authData } =
        await supabase.auth.getUser()

      const settlementStatus: SettlementStatus =
        isPaidStatus(paymentStatus)
          ? 'waived'
          : 'pending'

      const { data: assignmentData, error: insertError } =
        await supabase
          .from('delivery_assignments')
          .insert({
            company_id: companyId,
            delivery_id: delivery.id,
            order_id: delivery.order_id || null,
            driver_id: driver.id,
            driver_name: driver.name,
            driver_whatsapp: driver.whatsapp,
            vehicle_plate:
              driver.vehicle_plate || null,
            delivery_code: deliveryCode(delivery.id),
            customer_name:
              delivery.customer_name || null,
            customer_phone:
              delivery.customer_phone || null,
            address: delivery.address || null,
            neighborhood:
              delivery.neighborhood || null,
            map_url: route || null,
            payment_method:
              paymentMethod || null,
            payment_status:
              paymentStatus || null,
            order_total: orderTotal(order),
            delivery_fee: Number(
              delivery.delivery_fee || 0,
            ),
            status: 'out_for_delivery',
            assigned_at: now,
            out_for_delivery_at: now,
            settlement_status: settlementStatus,
            created_by:
              authData.user?.id || null,
            updated_at: now,
          })
          .select(
            'id, company_id, delivery_id, order_id, driver_id, driver_name, driver_whatsapp, vehicle_plate, delivery_code, customer_name, customer_phone, address, neighborhood, map_url, payment_method, payment_status, order_total, delivery_fee, status, assigned_at, out_for_delivery_at, delivered_at, settlement_status, settled_at, settlement_note, created_at, updated_at',
          )
          .single()

      if (insertError) throw insertError
      if (!assignmentData) {
        throw new Error(
          'Não foi possível registrar a alocação.',
        )
      }

      if (
        previousAssignment &&
        ['assigned', 'out_for_delivery'].includes(
          previousAssignment.status,
        )
      ) {
        const { error: previousError } = await supabase
          .from('delivery_assignments')
          .update({
            status: 'reassigned',
            updated_at: now,
          })
          .eq('id', previousAssignment.id)
          .eq('company_id', companyId)

        if (previousError) {
          await supabase
            .from('delivery_assignments')
            .delete()
            .eq('id', assignmentData.id)
            .eq('company_id', companyId)

          throw previousError
        }
      }

      const deliveryPatch: DeliveryPatch = {
        assigned_driver_id: driver.id,
        assigned_at: now,
        dispatched_at: now,
        status: 'out_for_delivery',
        updated_at: now,
      }

      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update(deliveryPatch)
        .eq('id', delivery.id)
        .eq('company_id', companyId)

      if (deliveryError) {
        await supabase
          .from('delivery_assignments')
          .delete()
          .eq('id', assignmentData.id)
          .eq('company_id', companyId)

        if (previousAssignment && previousStatus) {
          await supabase
            .from('delivery_assignments')
            .update({
              status: previousStatus,
              updated_at:
                previousAssignment.updated_at,
            })
            .eq('id', previousAssignment.id)
            .eq('company_id', companyId)
        }

        throw deliveryError
      }

      setAssignments((current) => [
        assignmentData as DeliveryAssignment,
        ...current.map((assignment) =>
          previousAssignment &&
          assignment.id === previousAssignment.id
            ? {
                ...assignment,
                status:
                  'reassigned' as AssignmentStatus,
                updated_at: now,
              }
            : assignment,
        ),
      ])

      onDeliveryPatch(delivery.id, deliveryPatch)
      onMessage(
        `Entrega alocada para ${driver.name} e marcada como saiu para entrega.`,
      )
      setAssignmentDelivery(null)
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Erro ao alocar entrega.',
      )
    } finally {
      setSavingAssignment(false)
    }
  }

  async function completeDelivery(
    delivery: DriverDeliveryRecord,
  ) {
    if (!companyId) return

    const confirmed = window.confirm(
      `Confirmar a entrega ${deliveryCode(
        delivery.id,
      )} como concluída?`,
    )

    if (!confirmed) return

    const now = new Date().toISOString()
    const assignment =
      latestAssignmentMap.get(delivery.id)

    const deliveryPatch: DeliveryPatch = {
      status: 'delivered',
      delivered_at: now,
      updated_at: now,
    }

    const { error: deliveryError } = await supabase
      .from('deliveries')
      .update(deliveryPatch)
      .eq('id', delivery.id)
      .eq('company_id', companyId)

    if (deliveryError) {
      onError(deliveryError.message)
      return
    }

    if (assignment) {
      const { error: assignmentError } =
        await supabase
          .from('delivery_assignments')
          .update({
            status: 'delivered',
            delivered_at: now,
            updated_at: now,
          })
          .eq('id', assignment.id)
          .eq('company_id', companyId)

      if (assignmentError) {
        onError(
          `A entrega foi concluída, mas o histórico não atualizou: ${assignmentError.message}`,
        )
      } else {
        setAssignments((current) =>
          current.map((item) =>
            item.id === assignment.id
              ? {
                  ...item,
                  status:
                    'delivered' as AssignmentStatus,
                  delivered_at: now,
                  updated_at: now,
                }
              : item,
          ),
        )
      }
    }

    onDeliveryPatch(delivery.id, deliveryPatch)
    onMessage('Entrega concluída com sucesso.')
  }

  async function settleAssignment(
    assignment: DeliveryAssignment,
  ) {
    if (!companyId) return

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('delivery_assignments')
      .update({
        settlement_status: 'settled',
        settled_at: now,
        updated_at: now,
      })
      .eq('id', assignment.id)
      .eq('company_id', companyId)

    if (error) {
      onError(error.message)
      return
    }

    setAssignments((current) =>
      current.map((item) =>
        item.id === assignment.id
          ? {
              ...item,
              settlement_status:
                'settled' as SettlementStatus,
              settled_at: now,
              updated_at: now,
            }
          : item,
      ),
    )

    onMessage(
      `Prestação de ${assignment.driver_name} marcada como conferida.`,
    )
  }

  const historyRows = useMemo(
    () =>
      assignments.filter((assignment) => {
        if (
          historyDate &&
          localDateKey(assignment.assigned_at) !==
            historyDate
        ) {
          return false
        }

        if (
          historyDriverId !== 'all' &&
          assignment.driver_id !== historyDriverId
        ) {
          return false
        }

        return true
      }),
    [assignments, historyDate, historyDriverId],
  )

  const historyStats = useMemo(() => {
    const rows = historyRows.filter(
      (assignment) =>
        !['reassigned', 'canceled'].includes(
          assignment.status,
        ),
    )

    return {
      total: rows.length,
      delivered: rows.filter(
        (assignment) =>
          assignment.status === 'delivered',
      ).length,
      pendingSettlement: rows
        .filter(
          (assignment) =>
            assignment.settlement_status === 'pending',
        )
        .reduce(
          (sum, assignment) =>
            sum + Number(assignment.order_total || 0),
          0,
        ),
      deliveryFees: rows.reduce(
        (sum, assignment) =>
          sum + Number(assignment.delivery_fee || 0),
        0,
      ),
    }
  }, [historyRows])

  const contextValue: ContextValue = {
    drivers,
    openDrivers,
    openHistory,
    openAssignment,
    completeDelivery,
    getDriverForDelivery,
    getAssignmentForDelivery,
    driverWhatsappForDelivery,
  }

  return (
    <DriverOperationsContext.Provider
      value={contextValue}
    >
      {children}

      {assignmentDelivery ? (
        <div className="fixed inset-0 z-[110] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Fechar alocação"
            onClick={() => {
              if (!savingAssignment) {
                setAssignmentDelivery(null)
              }
            }}
            className="absolute inset-0 bg-[#071b3a]/60 backdrop-blur-sm"
          />

          <section className="relative w-full max-w-xl overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-2xl shadow-blue-950/30">
            <header className="border-b border-slate-200 bg-[#071b3a] p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200/70">
                    {deliveryCode(
                      assignmentDelivery.id,
                    )}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">
                    Alocar entregador
                  </h2>
                  <p className="mt-2 text-sm font-bold text-white/55">
                    O pedido será liberado para a rota.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAssignmentDelivery(null)
                  }
                  disabled={savingAssignment}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xl font-black text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-[#f7f9fc] p-4">
                <p className="font-black text-[#071b3a]">
                  {assignmentDelivery.customer_name ||
                    'Cliente sem nome'}
                </p>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                  {assignmentDelivery.address ||
                    'Endereço não informado'}
                </p>
                {assignmentDelivery.neighborhood ? (
                  <p className="mt-1 text-xs font-black text-slate-400">
                    {assignmentDelivery.neighborhood}
                  </p>
                ) : null}
              </div>

              <label className={`${labelClass} mt-5`}>
                Entregador responsável
                <select
                  value={selectedDriverId}
                  onChange={(event) =>
                    setSelectedDriverId(
                      event.target.value,
                    )
                  }
                  className={inputClass}
                >
                  {drivers
                    .filter((driver) => driver.is_active)
                    .map((driver) => (
                      <option
                        key={driver.id}
                        value={driver.id}
                      >
                        {driver.name}
                        {driver.vehicle_plate
                          ? ` • ${driver.vehicle_plate}`
                          : ''}
                      </option>
                    ))}
                </select>
              </label>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setAssignmentDelivery(null)
                  }
                  disabled={savingAssignment}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void allocateDelivery()
                  }
                  disabled={
                    savingAssignment ||
                    !selectedDriverId
                  }
                  className="rounded-2xl bg-[#05245c] px-4 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAssignment
                    ? 'Alocando...'
                    : assignmentDelivery.assigned_driver_id
                      ? 'Realocar entrega'
                      : 'Alocar e liberar rota'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {driversOpen ? (
        <div className="fixed inset-0 z-[105]">
          <button
            type="button"
            aria-label="Fechar entregadores"
            onClick={() => setDriversOpen(false)}
            className="absolute inset-0 bg-[#071b3a]/55 backdrop-blur-sm"
          />

          <section className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col overflow-hidden bg-[#f7f9fc] shadow-2xl shadow-blue-950/30">
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-[#0a4b9f]">
                    Equipe de rua
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
                    Entregadores
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-400">
                    Cadastre nome, WhatsApp e placa.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDriversOpen(false)
                  }
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-500 transition hover:bg-slate-50"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <form
                onSubmit={saveDriver}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {editingDriverId
                      ? 'Editar entregador'
                      : 'Novo entregador'}
                  </p>

                  {editingDriverId ? (
                    <button
                      type="button"
                      onClick={resetDriverForm}
                      className="text-xs font-black text-[#05245c] hover:underline"
                    >
                      Novo cadastro
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Nome
                    <input
                      value={driverForm.name}
                      onChange={(event) =>
                        setDriverForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Nome do entregador"
                    />
                  </label>

                  <label className={labelClass}>
                    WhatsApp
                    <input
                      value={driverForm.whatsapp}
                      onChange={(event) =>
                        setDriverForm((current) => ({
                          ...current,
                          whatsapp:
                            event.target.value,
                        }))
                      }
                      className={inputClass}
                      inputMode="tel"
                      placeholder="(82) 99999-9999"
                    />
                  </label>

                  <label className={labelClass}>
                    Placa da moto
                    <input
                      value={driverForm.vehicle_plate}
                      onChange={(event) =>
                        setDriverForm((current) => ({
                          ...current,
                          vehicle_plate:
                            normalizePlate(
                              event.target.value,
                            ),
                        }))
                      }
                      className={inputClass}
                      placeholder="ABC1D23"
                    />
                  </label>

                  <label className={labelClass}>
                    Observação
                    <input
                      value={driverForm.notes}
                      onChange={(event) =>
                        setDriverForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Turno, região ou detalhe"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingDriver}
                  className="mt-4 w-full rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:opacity-60"
                >
                  {savingDriver
                    ? 'Salvando...'
                    : editingDriverId
                      ? 'Salvar alterações'
                      : 'Cadastrar entregador'}
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {loadingOperations ? (
                  <p className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-400">
                    Carregando entregadores...
                  </p>
                ) : drivers.length ? (
                  drivers.map((driver) => (
                    <article
                      key={driver.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-[#071b3a]">
                              {driver.name}
                            </p>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                                driver.is_active
                                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-100 text-slate-500'
                              }`}
                            >
                              {driver.is_active
                                ? 'Ativo'
                                : 'Inativo'}
                            </span>
                          </div>

                          <p className="mt-1 text-sm font-bold text-slate-500">
                            {driver.whatsapp}
                          </p>
                          <p className="mt-1 text-xs font-black text-slate-400">
                            {driver.vehicle_plate ||
                              'Placa não informada'}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <a
                            href={whatsappUrl(
                              driver.whatsapp,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                          >
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              editDriver(driver)
                            }
                            className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-[#05245c] transition hover:bg-blue-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void toggleDriver(driver)
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                          >
                            {driver.is_active
                              ? 'Desativar'
                              : 'Ativar'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <p className="text-sm font-black text-slate-500">
                      Nenhum entregador cadastrado
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      O primeiro cadastro ficará disponível para alocação.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-[105] overflow-y-auto bg-[#071b3a]/60 p-3 backdrop-blur-sm sm:p-5">
          <section className="mx-auto min-h-full max-w-[1350px] overflow-hidden rounded-[1.9rem] bg-[#f4f6fa] shadow-2xl shadow-blue-950/30">
            <header className="relative overflow-hidden bg-[#071b3a] p-5 text-white sm:p-7">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />

              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                    Prestação de contas
                  </p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.05em]">
                    Histórico de entregas
                  </h2>
                  <p className="mt-2 text-sm font-bold text-white/55">
                    Alocações, horários, rotas, valores e conferência por entregador.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="grid h-11 w-11 place-items-center self-end rounded-2xl bg-white/10 text-xl font-black text-white transition hover:bg-white/15"
                >
                  ×
                </button>
              </div>

              <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Entregas', String(historyStats.total)],
                  [
                    'Concluídas',
                    String(historyStats.delivered),
                  ],
                  [
                    'A prestar contas',
                    money(
                      historyStats.pendingSettlement,
                    ),
                  ],
                  [
                    'Taxas do período',
                    money(historyStats.deliveryFees),
                  ],
                ].map(([label, value]) => (
                  <article
                    key={label}
                    className="rounded-[1.25rem] border border-white/10 bg-white/[0.07] p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {value}
                    </p>
                  </article>
                ))}
              </div>
            </header>

            <div className="p-4 sm:p-6">
              <div className="grid gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Data
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(event) =>
                      setHistoryDate(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Entregador
                  <select
                    value={historyDriverId}
                    onChange={(event) =>
                      setHistoryDriverId(
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="all">
                      Todos os entregadores
                    </option>
                    {drivers.map((driver) => (
                      <option
                        key={driver.id}
                        value={driver.id}
                      >
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 grid gap-3">
                {historyRows.length ? (
                  historyRows.map((assignment) => {
                    const driverPhone = whatsappUrl(
                      assignment.driver_whatsapp,
                      assignmentMessage(assignment),
                    )
                    const statusTone =
                      assignment.status === 'delivered'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : assignment.status ===
                            'out_for_delivery'
                          ? 'border-cyan-100 bg-cyan-50 text-cyan-700'
                          : assignment.status ===
                              'reassigned'
                            ? 'border-slate-200 bg-slate-100 text-slate-500'
                            : 'border-blue-100 bg-blue-50 text-blue-700'

                    return (
                      <article
                        key={assignment.id}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-[#071b3a]">
                                {assignment.delivery_code ||
                                  deliveryCode(
                                    assignment.delivery_id ||
                                      assignment.id,
                                  )}
                              </p>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusTone}`}
                              >
                                {assignmentStatusLabel(
                                  assignment.status,
                                )}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                                  assignment.settlement_status ===
                                  'settled'
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                    : assignment.settlement_status ===
                                        'waived'
                                      ? 'border-blue-100 bg-blue-50 text-blue-700'
                                      : 'border-amber-100 bg-amber-50 text-amber-700'
                                }`}
                              >
                                {settlementLabel(
                                  assignment.settlement_status,
                                )}
                              </span>
                            </div>

                            <h3 className="mt-3 text-lg font-black tracking-[-0.03em] text-[#071b3a]">
                              {assignment.driver_name}
                              {assignment.vehicle_plate
                                ? ` • ${assignment.vehicle_plate}`
                                : ''}
                            </h3>

                            <p className="mt-1 text-sm font-bold text-slate-500">
                              {assignment.customer_name ||
                                'Cliente não informado'}
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                              {assignment.address ||
                                'Endereço não informado'}
                              {assignment.neighborhood
                                ? ` • ${assignment.neighborhood}`
                                : ''}
                            </p>
                          </div>

                          <div className="grid min-w-0 gap-2 sm:grid-cols-4 xl:min-w-[560px]">
                            {[
                              [
                                'Alocada',
                                formatDateTime(
                                  assignment.assigned_at,
                                ),
                              ],
                              [
                                'Entregue',
                                formatDateTime(
                                  assignment.delivered_at,
                                ),
                              ],
                              [
                                'Pedido',
                                money(
                                  assignment.order_total,
                                ),
                              ],
                              [
                                'Taxa',
                                money(
                                  assignment.delivery_fee,
                                ),
                              ],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded-xl border border-slate-100 bg-[#f7f9fc] p-3"
                              >
                                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                                  {label}
                                </p>
                                <p className="mt-1 text-xs font-black text-slate-600">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                          {driverPhone ? (
                            <a
                              href={driverPhone}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                            >
                              WhatsApp com rota
                            </a>
                          ) : null}

                          {assignment.map_url ? (
                            <a
                              href={assignment.map_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                            >
                              Google Maps
                            </a>
                          ) : null}

                          {assignment.payment_method ? (
                            <span className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-500">
                              {assignment.payment_method}
                            </span>
                          ) : null}

                          {assignment.settlement_status ===
                          'pending' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void settleAssignment(
                                  assignment,
                                )
                              }
                              className="rounded-xl bg-[#05245c] px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#031a43]"
                            >
                              Marcar prestação conferida
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="font-black text-slate-500">
                      Nenhuma entrega nesse filtro
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-400">
                      Altere a data ou selecione outro entregador.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </DriverOperationsContext.Provider>
  )
}

export function DeliveryDriverHeaderButtons() {
  const { openDrivers, openHistory } =
    useDriverOperations()

  const buttonClass =
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15'

  return (
    <>
      <button
        type="button"
        onClick={openDrivers}
        className={buttonClass}
      >
        <span aria-hidden="true">🛵</span>
        Entregadores
      </button>

      <button
        type="button"
        onClick={openHistory}
        className={buttonClass}
      >
        <span aria-hidden="true">▤</span>
        Histórico
      </button>
    </>
  )
}

export function DeliveryDriverAction({
  delivery,
  compact = false,
}: {
  delivery: DriverDeliveryRecord
  compact?: boolean
}) {
  const {
    openAssignment,
    completeDelivery,
    getDriverForDelivery,
  } = useDriverOperations()

  const status = String(delivery.status || '')
  const driver = getDriverForDelivery(delivery)

  if (status === 'ready_for_delivery') {
    return (
      <button
        type="button"
        onClick={() => openAssignment(delivery)}
        className={
          compact
            ? 'col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#031a43]'
            : 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#031a43]'
        }
      >
        Alocar entregador
        <span aria-hidden="true">→</span>
      </button>
    )
  }

  if (status === 'out_for_delivery') {
    return (
      <>
        <button
          type="button"
          onClick={() =>
            void completeDelivery(delivery)
          }
          className={
            compact
              ? 'col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#031a43]'
              : 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#031a43]'
          }
        >
          {driver
            ? `Confirmar entrega • ${driver.name}`
            : 'Confirmar entrega'}
          <span aria-hidden="true">✓</span>
        </button>

        <button
          type="button"
          onClick={() => openAssignment(delivery)}
          className="inline-flex items-center justify-center rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 text-xs font-black text-violet-700 transition hover:bg-violet-100"
        >
          {driver
            ? 'Trocar entregador'
            : 'Alocar entregador'}
        </button>
      </>
    )
  }

  return null
}

export function DeliveryDriverInfo({
  delivery,
}: {
  delivery: DriverDeliveryRecord
}) {
  const {
    getDriverForDelivery,
    getAssignmentForDelivery,
    driverWhatsappForDelivery,
  } = useDriverOperations()

  const driver = getDriverForDelivery(delivery)
  const assignment =
    getAssignmentForDelivery(delivery)

  if (!driver && !assignment) return null

  const name =
    driver?.name ||
    assignment?.driver_name ||
    'Entregador'
  const plate =
    driver?.vehicle_plate ||
    assignment?.vehicle_plate ||
    ''
  const assignedAt =
    assignment?.assigned_at ||
    delivery.assigned_at ||
    null
  const whatsapp =
    driverWhatsappForDelivery(delivery)

  return (
    <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-500">
            Entregador alocado
          </p>
          <p className="mt-1 truncate text-xs font-black text-violet-800">
            {name}
            {plate ? ` • ${plate}` : ''}
          </p>
          <p className="mt-1 text-[10px] font-bold text-violet-400">
            {formatDateTime(assignedAt)}
          </p>
        </div>

        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-50"
          >
            Enviar rota
          </a>
        ) : null}
      </div>
    </div>
  )
}
