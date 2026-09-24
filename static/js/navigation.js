export function activateInspectorTab(name,root=document){
  for(const tab of root.querySelectorAll('.tab'))tab.classList.toggle('active',tab.dataset.tab===name);
  for(const panel of root.querySelectorAll('.tab-panel'))panel.classList.toggle('active',panel.dataset.panel===name);
}
