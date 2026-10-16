import type { Component } from 'vue'
// Shared with the server, which validates Training Steps against it.
import registry from '../../../dms_training/screens.json'
import DeliveryAssign from './delivery/DeliveryAssign.vue'
import DeliveryCompleted from './delivery/DeliveryCompleted.vue'
import DeliveryHome from './delivery/DeliveryHome.vue'
import DeliveryNote from './delivery/DeliveryNote.vue'
import DeliveryPending from './delivery/DeliveryPending.vue'
import CustomerBalanceReport from './dms/CustomerBalanceReport.vue'
import SoStatusReport from './dms/SoStatusReport.vue'
import DnForm from './desk/DnForm.vue'
import DnList from './desk/DnList.vue'
import PeForm from './desk/PeForm.vue'
import PeList from './desk/PeList.vue'
import SiForm from './desk/SiForm.vue'
import SiList from './desk/SiList.vue'
import SoForm from './desk/SoForm.vue'
import SoList from './desk/SoList.vue'
import OrderHistory from './portal/OrderHistory.vue'
import PendingOrders from './portal/PendingOrders.vue'
import SalesCustomer from './portal/SalesCustomer.vue'
import SalesHome from './portal/SalesHome.vue'
import SalesOrder from './portal/SalesOrder.vue'

/**
 * Screen key → the Vue component that simulates it. Adding a screen means a
 * component here and an entry in screens.json listing its `data-tour` targets.
 */
export const screenComponents: Record<string, Component> = {
  'portal.sales_home': SalesHome,
  'portal.sales_customer': SalesCustomer,
  'portal.sales_order': SalesOrder,
  'portal.pending_orders': PendingOrders,
  'portal.order_history': OrderHistory,
  'desk.so_list': SoList,
  'desk.so_form': SoForm,
  'desk.dn_list': DnList,
  'desk.dn_form': DnForm,
  'desk.si_list': SiList,
  'desk.si_form': SiForm,
  'desk.pe_list': PeList,
  'desk.pe_form': PeForm,
  'dms.so_status': SoStatusReport,
  'dms.customer_balance': CustomerBalanceReport,
  'delivery.home': DeliveryHome,
  'delivery.assign': DeliveryAssign,
  'delivery.pending': DeliveryPending,
  'delivery.completed': DeliveryCompleted,
  'delivery.note': DeliveryNote,
}

const screens = registry.screens as Record<string, { label: string }>

export function screenLabel(key: string): string {
  return screens[key]?.label ?? key
}
