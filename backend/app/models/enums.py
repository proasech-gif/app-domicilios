import enum


class BusinessType(str, enum.Enum):
    restaurante = "restaurante"
    supermercado = "supermercado"
    farmacia = "farmacia"
    tienda = "tienda"
    mascota = "mascota"
    belleza = "belleza"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class OrderStatus(str, enum.Enum):
    creado = "creado"
    confirmado_comercio = "confirmado_comercio"
    en_preparacion = "en_preparacion"
    listo_para_recoger = "listo_para_recoger"
    domiciliario_asignado = "domiciliario_asignado"
    en_camino_a_comercio = "en_camino_a_comercio"
    recogido = "recogido"
    en_camino_a_cliente = "en_camino_a_cliente"
    entregado = "entregado"
    cancelado = "cancelado"


class PaymentMethod(str, enum.Enum):
    efectivo = "efectivo"
    tarjeta = "tarjeta"
    billetera_digital = "billetera_digital"


class VehicleType(str, enum.Enum):
    moto = "moto"
    bicicleta = "bicicleta"
    carro = "carro"
    a_pie = "a_pie"


class PaymentStatus(str, enum.Enum):
    pendiente = "pendiente"  # aún no se ha pagado (pago online) o se paga contra-entrega
    aprobado = "aprobado"  # pago online confirmado por la pasarela
    rechazado = "rechazado"
    error = "error"
    contra_entrega = "contra_entrega"  # efectivo, se cobra al momento de la entrega


class WalletTransactionType(str, enum.Enum):
    credito = "credito"
    debito = "debito"


class WithdrawalStatus(str, enum.Enum):
    pendiente = "pendiente"
    completado = "completado"
    rechazado = "rechazado"
