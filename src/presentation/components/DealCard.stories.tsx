import React from 'react';
import { DealCard, type DealCardProps } from './ui/DealCard.tsx';

export type DealStoryProps = DealCardProps;

export const DealCardPreview: React.FC<DealStoryProps> = (props) => <DealCard {...props} />;

export default {
  title: 'CRM/AmoDealCard',
  component: DealCardPreview,
};

export const Default = {
  args: {
    title: 'NordStar Logistics — Внедрение Enterprise CRM',
    budget: 2450000,
    currency: 'RUB',
    companyName: 'NordStar Logistics',
    contactName: 'Виктор Громов',
    ownerName: 'Елена Смирнова',
    openTasksCount: 2,
    hasOverdueTask: false,
    tags: ['Enterprise', 'Годовой контракт'],
  },
};
