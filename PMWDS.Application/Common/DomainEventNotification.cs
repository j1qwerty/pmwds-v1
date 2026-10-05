using MediatR;
using PMWDS.Domain.Common;

namespace PMWDS.Application.Common;

public sealed record DomainEventNotification<TDomainEvent>(TDomainEvent DomainEvent)
    : INotification
    where TDomainEvent : IDomainEvent;
